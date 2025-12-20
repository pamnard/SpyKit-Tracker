package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
)

func main() {
	log.Println("Starting SpyKit Processor...")

	// 1. Config
	port := getenv("PROCESSOR_PORT", "8080")
	chHost := getenv("CLICKHOUSE_HOST", "clickhouse:8123")
	chUser := getenv("CLICKHOUSE_USER", "default")
	chPass := getenv("CLICKHOUSE_PASSWORD", "")

	// 2. Connect to ClickHouse
	ch := mustConnectClickHouse(chHost, chUser, chPass)

	// 2.5. Init Fingerprint Service (Session Handoff)
	// Using BadgerDB for persistence. Path: ./badger-data
	fpService, err := NewFingerprintService("./badger-data", 7*24*time.Hour)
	if err != nil {
		log.Fatalf("Failed to init fingerprint service: %v", err)
	}
	defer fpService.Close()

	// 3. HTTP Handler
	http.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Prepare ClickHouse batch
		batch, err := ch.PrepareBatch(context.Background(), "INSERT INTO default.events (timestamp, event_name, ids, page, device, geo, traffic, tech, params)")
		if err != nil {
			log.Printf("Failed to prepare batch: %v", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}

		// Stream processing: Read line by line (NDJSON) directly from request body
		scanner := bufio.NewScanner(r.Body)
		count := 0

		for scanner.Scan() {
			line := scanner.Bytes()
			if len(bytes.TrimSpace(line)) == 0 {
				continue
			}

			var rawEvent map[string]interface{}
			if err := json.Unmarshal(line, &rawEvent); err != nil {
				log.Printf("Skipping bad NDJSON line: %v", err)
				continue
			}

			// 2.6. Identify / Link Sessions
			if linkedID, found := fpService.Identify(rawEvent); found {
				// SWAP the ID: Continue the session of the identified user
				rawEvent["visitor_id"] = linkedID
			}

			// Map & Enrich
			event, err := MapToEvent(rawEvent)
			if err != nil {
				log.Printf("Skipping invalid event: %v", err)
				continue
			}

			// 3. Add to batch
			if err := batch.Append(
				event.Timestamp,
				event.EventName,
				event.IDs,
				event.Page,
				event.Device,
				event.Geo,
				event.Traffic,
				event.Tech,
				event.Params,
			); err != nil {
				log.Printf("Failed to append to batch: %v", err)
			}
			count++
		}

		if err := scanner.Err(); err != nil {
			log.Printf("Scanner error: %v", err)
			http.Error(w, "Stream error", http.StatusBadRequest)
			return
		}

		if count == 0 {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Send to ClickHouse
		if err := batch.Send(); err != nil {
			log.Printf("Failed to send batch to ClickHouse: %v", err)
			http.Error(w, "Upstream error", http.StatusBadGateway)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	// 4. Start Server
	log.Printf("Processor listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}


func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func mustConnectClickHouse(host, user, pass string) clickhouse.Conn {
	opts := &clickhouse.Options{
		Addr: []string{host},
		Auth: clickhouse.Auth{
			Database: "default",
			Username: user,
			Password: pass,
		},
		Protocol:         clickhouse.HTTP,
		DialTimeout:      5 * time.Second,
		ConnOpenStrategy: clickhouse.ConnOpenInOrder,
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		log.Fatalf("clickhouse: open failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := conn.Ping(ctx); err != nil {
		log.Fatalf("clickhouse: ping failed: %v", err)
	}

	return conn
}
