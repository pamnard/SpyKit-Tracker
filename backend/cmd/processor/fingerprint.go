package main

import (
	"encoding/json"
	"fmt"
	"time"

	badger "github.com/dgraph-io/badger/v4"
)

const (
	// nGramSize defines the size of n-grams for Jaccard similarity calculation
	nGramSize = 3
	// fingerprintSimilarityThreshold defines the minimum Jaccard similarity
	// for two fingerprints to be considered a match (0.0 to 1.0)
	fingerprintSimilarityThreshold = 0.75
)

// ShortTermIdentity stores data for identification within a short window
type ShortTermIdentity struct {
	VisitorID   string          `json:"vid"`
	Fingerprint FingerprintData `json:"fp"`
	SeenAt      time.Time       `json:"t"`
}

type FingerprintData struct {
	CanvasHash string `json:"cnv"`
	AudioHash  string `json:"aud"`
	WebGLHash  string `json:"gl"`
	TLSHash    string `json:"tls"`
}

type FingerprintService struct {
	db  *badger.DB
	ttl time.Duration
}

// jaccardSimilarity computes Jaccard similarity coefficient for two hash strings using n-grams.
// Returns a value between 0.0 (completely different) and 1.0 (identical).
func jaccardSimilarity(hash1, hash2 string, n int) float64 {
	if hash1 == hash2 {
		return 1.0
	}
	if len(hash1) < n || len(hash2) < n {
		return 0.0
	}

	set1 := make(map[string]bool)
	set2 := make(map[string]bool)

	for i := 0; i <= len(hash1)-n; i++ {
		set1[hash1[i:i+n]] = true
	}
	for i := 0; i <= len(hash2)-n; i++ {
		set2[hash2[i:i+n]] = true
	}

	intersection := 0
	for k := range set1 {
		if set2[k] {
			intersection++
		}
	}

	union := len(set1) + len(set2) - intersection
	if union == 0 {
		return 0.0
	}

	return float64(intersection) / float64(union)
}

// fuzzyMatch checks if two hash strings are similar based on Jaccard similarity threshold.
func fuzzyMatch(hash1, hash2 string, threshold float64) bool {
	if hash1 == "" || hash2 == "" {
		return false
	}
	similarity := jaccardSimilarity(hash1, hash2, nGramSize)
	return similarity >= threshold
}

// NewFingerprintService initializes BadgerDB
func NewFingerprintService(dbPath string, ttl time.Duration) (*FingerprintService, error) {
	opts := badger.DefaultOptions(dbPath)
	opts.Logger = nil // Disable default logger

	db, err := badger.Open(opts)
	if err != nil {
		return nil, err
	}

	// Start GC loop to reclaim disk space
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
		again:
			err := db.RunValueLogGC(0.7)
			if err == nil {
				goto again
			}
		}
	}()

	return &FingerprintService{
		db:  db,
		ttl: ttl,
	}, nil
}

// Close closes the database connection
func (s *FingerprintService) Close() error {
	return s.db.Close()
}

// Identify checks if the current visitor matches any recent visitor in the cache.
// Returns (linkedVisitorID, found).
func (s *FingerprintService) Identify(rawEvent map[string]interface{}) (string, bool) {
	device, ok := rawEvent["device"].(map[string]interface{})
	if !ok {
		return "", false
	}

	bucketKey := buildBucketKey(device)
	if bucketKey == "" {
		return "", false
	}

	currentFP := extractHeavyFingerprint(rawEvent, device)
	if currentFP == nil {
		return "", false
	}

	currentVisitorID := extractVisitorID(rawEvent)
	if currentVisitorID == "" {
		return "", false
	}

	return s.processCache(bucketKey, currentVisitorID, *currentFP)
}

// buildBucketKey constructs a stable key for grouping similar users.
// It uses stable device signals (Timezone, Platform, Language, etc.) and
// excludes volatile ones (IP, UserAgent versions).
func buildBucketKey(device map[string]interface{}) string {
	timezone := toString(device["timezone"])
	platform := toString(device["platform"])
	language := toString(device["language"])
	concurrency := toString(device["hardwareConcurrency"])

	// Protection against empty keys
	if timezone == "" && platform == "" {
		return ""
	}

	// Screen Resolution Normalization
	w := getFloat(device["screenWidth"])
	h := getFloat(device["screenHeight"])
	if h > w {
		w, h = h, w
	}
	screenRes := fmt.Sprintf("%.0fx%.0f", w, h)

	pixelRatio := getFloat(device["pixelRatio"])
	colorDepth := getFloat(device["colorDepth"])

	return fmt.Sprintf("%s|%s|%s|%s|%s|%.2f|%.0f",
		timezone, platform, language, screenRes, concurrency, pixelRatio, colorDepth)
}

// extractHeavyFingerprint extracts high-entropy fingerprint data (canvas, audio, etc.).
// Returns nil if no heavy signals are found.
func extractHeavyFingerprint(rawEvent map[string]interface{}, device map[string]interface{}) *FingerprintData {
	fpData, fpOk := device["fingerprint"].(map[string]interface{})
	if !fpOk {
		return nil
	}

	canvasHash := toString(fpData["canvas"])
	audioHash := toString(fpData["audio"])
	webglHash := toString(fpData["webgl"])
	tlsHash := getNestedString(rawEvent, "server", "tls_fingerprint")

	if canvasHash == "" && audioHash == "" && webglHash == "" && tlsHash == "" {
		return nil
	}

	return &FingerprintData{
		CanvasHash: canvasHash,
		AudioHash:  audioHash,
		WebGLHash:  webglHash,
		TLSHash:    tlsHash,
	}
}

// extractVisitorID gets the best available ID (visitor_id or fallback to device_id).
func extractVisitorID(rawEvent map[string]interface{}) string {
	vid := toString(rawEvent["visitor_id"])
	if vid == "" {
		vid = toString(rawEvent["device_id"])
	}
	return vid
}

// processCache manages the cache: cleans expired items, finds matches, and adds the current user.
// Returns the linked VisitorID if a match is found, otherwise empty string.
func (s *FingerprintService) processCache(bucketKey, currentVisitorID string, currentFP FingerprintData) (string, bool) {
	var bestMatchID string
	var maxScore float64
	now := time.Now()

	err := s.db.Update(func(txn *badger.Txn) error {
		// 1. Get existing candidates
		var candidates []ShortTermIdentity
		item, err := txn.Get([]byte(bucketKey))
		if err == nil {
			err = item.Value(func(val []byte) error {
				return json.Unmarshal(val, &candidates)
			})
			if err != nil {
				// If unmarshal fails, we treat it as empty and overwrite
				candidates = []ShortTermIdentity{}
			}
		} else if err != badger.ErrKeyNotFound {
			return err
		}

		// 2. Filter and Match
		validCandidates := make([]ShortTermIdentity, 0, len(candidates))
		for _, cand := range candidates {
			// TTL logic: even if Badger handles key expiry, the list value might contain old entries
			// if the key was updated recently. So we filter manually too.
			if now.Sub(cand.SeenAt) > s.ttl {
				continue
			}
			validCandidates = append(validCandidates, cand)

			if cand.VisitorID != currentVisitorID {
				score := calculateSimilarityScore(currentFP, cand.Fingerprint)
				if score > maxScore && score >= fingerprintSimilarityThreshold {
					maxScore = score
					bestMatchID = cand.VisitorID
				}
			}
		}

		// 3. Add current
		validCandidates = append(validCandidates, ShortTermIdentity{
			VisitorID:   currentVisitorID,
			Fingerprint: currentFP,
			SeenAt:      now,
		})

		// 4. Save
		data, err := json.Marshal(validCandidates)
		if err != nil {
			return err
		}

		// Set Entry with TTL
		// Each update refreshes the TTL for the whole bucket
		return txn.SetEntry(badger.NewEntry([]byte(bucketKey), data).WithTTL(s.ttl))
	})

	if err != nil {
		fmt.Printf("Fingerprint DB Error: %v\n", err)
		return "", false
	}

	return bestMatchID, bestMatchID != ""
}

// calculateSimilarityScore sums up Jaccard similarities for all available signals.
// Higher score means better match.
func calculateSimilarityScore(fp1, fp2 FingerprintData) float64 {
	score := 0.0
	score += jaccardSimilarity(fp1.TLSHash, fp2.TLSHash, nGramSize)
	score += jaccardSimilarity(fp1.CanvasHash, fp2.CanvasHash, nGramSize)
	score += jaccardSimilarity(fp1.WebGLHash, fp2.WebGLHash, nGramSize)
	score += jaccardSimilarity(fp1.AudioHash, fp2.AudioHash, nGramSize)
	return score
}

// Helper to safely get nested map values
func getNestedString(root map[string]interface{}, path ...string) string {
	curr := root
	for i, key := range path {
		val, ok := curr[key]
		if !ok {
			return ""
		}

		if i == len(path)-1 {
			return toString(val)
		}

		if nextMap, ok := val.(map[string]interface{}); ok {
			curr = nextMap
		} else {
			return ""
		}
	}
	return ""
}

// getFloat safely extracts a float64 from an interface
func getFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	default:
		return 0
	}
}
