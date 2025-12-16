package main

import (
	"fmt"
	"sync"
	"time"
)

// ShortTermIdentity stores data for identification within a short window
type ShortTermIdentity struct {
	VisitorID   string
	Fingerprint FingerprintData
	SeenAt      time.Time
}

type FingerprintData struct {
	CanvasHash string
	AudioHash  string
	WebGLHash  string
}

type FingerprintService struct {
	// BucketKey -> []ShortTermIdentity
	// BucketKey reduces search space (e.g. IP + Screen + OS)
	cache map[string][]ShortTermIdentity
	mu    sync.RWMutex
	ttl   time.Duration
}

func NewFingerprintService(ttl time.Duration) *FingerprintService {
	s := &FingerprintService{
		cache: make(map[string][]ShortTermIdentity),
		ttl:   ttl,
	}
	go s.cleanupLoop()
	return s
}

// Identify checks if the current visitor matches any recent visitor in the cache.
// Returns (linkedVisitorID, found).
func (s *FingerprintService) Identify(rawEvent map[string]interface{}) (string, bool) {
	// 1. Extract data needed for key & matching
	device, ok := rawEvent["device"].(map[string]interface{})
	if !ok {
		return "", false
	}

	// Extract Bucket Components (IP, Screen, Timezone, Platform)
	// Try to find IP in server info or root
	ip := getNestedString(rawEvent, "server", "ip")
	if ip == "" {
		ip = getNestedString(rawEvent, "ip")
	}

	screenWidth := toString(device["screenWidth"])
	timezone := toString(device["timezone"])
	platform := toString(device["platform"])

	// Strict bucketing: We need IP and Screen Width at minimum
	if ip == "" || screenWidth == "" {
		return "", false
	}

	// 2. Build Bucket Key
	// Key = IP_Subnet(Full IP for now) | ScreenWidth | Timezone | Platform
	// This groups users who are on the same network, device model, and settings.
	bucketKey := fmt.Sprintf("%s|%s|%s|%s", ip, screenWidth, timezone, platform)

	// 3. Extract Heavy Fingerprint
	// We need at least one heavy signal to confirm identity within the bucket.
	fpData, fpOk := device["fingerprint"].(map[string]interface{})
	if !fpOk {
		return "", false
	}
	canvasHash := toString(fpData["canvas"])
	audioHash := toString(fpData["audio"])
	webglHash := toString(fpData["webgl"])
	
	// We need at least one heavy signal
	if canvasHash == "" && audioHash == "" && webglHash == "" {
		return "", false
	}

	currentFP := FingerprintData{
		CanvasHash: canvasHash,
		AudioHash:  audioHash,
		WebGLHash:  webglHash,
	}

	currentVisitorID := toString(rawEvent["visitor_id"])
	if currentVisitorID == "" {
		currentVisitorID = toString(rawEvent["device_id"]) // Fallback
	}
	if currentVisitorID == "" {
		return "", false
	}

	// 4. Lookup & Match
	s.mu.Lock()
	defer s.mu.Unlock()

	candidates := s.cache[bucketKey]
	var foundID string

	// Filter expired and match
	validCandidates := make([]ShortTermIdentity, 0, len(candidates))
	now := time.Now()

	for _, cand := range candidates {
		if now.Sub(cand.SeenAt) > s.ttl {
			continue
		}
		validCandidates = append(validCandidates, cand)

		// Match Logic:
		// If we haven't found a match yet...
		if foundID == "" {
			// Check if it's NOT the same ID (we want to link DIFFERENT sessions/domains)
			if cand.VisitorID != currentVisitorID {
				// Match Logic:
				// If Canvas matches AND it's not empty -> Match
				if currentFP.CanvasHash != "" && cand.Fingerprint.CanvasHash == currentFP.CanvasHash {
					foundID = cand.VisitorID
				}
				// If Audio matches AND it's not empty -> Match (Backup signal)
				if currentFP.AudioHash != "" && cand.Fingerprint.AudioHash == currentFP.AudioHash {
					foundID = cand.VisitorID
				}
				// If WebGL matches AND it's not empty -> Match
				if currentFP.WebGLHash != "" && cand.Fingerprint.WebGLHash == currentFP.WebGLHash {
					foundID = cand.VisitorID
				}
			}
		}
	}

	// Update cache with cleaned list
	s.cache[bucketKey] = validCandidates

	// Add current user to cache
	// We append to the list so this user can be found by others (or subsequent requests)
	s.cache[bucketKey] = append(s.cache[bucketKey], ShortTermIdentity{
		VisitorID:   currentVisitorID,
		Fingerprint: currentFP,
		SeenAt:      now,
	})

	if foundID != "" {
		return foundID, true
	}

	return "", false
}

func (s *FingerprintService) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for key, candidates := range s.cache {
			valid := make([]ShortTermIdentity, 0)
			for _, c := range candidates {
				if now.Sub(c.SeenAt) < s.ttl {
					valid = append(valid, c)
				}
			}
			if len(valid) == 0 {
				delete(s.cache, key)
			} else {
				s.cache[key] = valid
			}
		}
		s.mu.Unlock()
	}
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

