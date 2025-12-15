// Command spykit-backend exposes the SpyKit admin API and ClickHouse stats.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"

	"example.com/spykit-backend/internal/api"
	"example.com/spykit-backend/internal/meta"
)

func main() {
	port := getenv("BACKEND_PORT", "3000")

	// ... rest of env vars ...
	chHost := getenv("CLICKHOUSE_HOST", "")
	if chHost == "" {
		log.Fatalf("CLICKHOUSE_HOST is required")
	}

	chUser := getenv("CLICKHOUSE_USER", "default")
	chPass := getenv("CLICKHOUSE_PASSWORD", "")

	ch := mustConnectClickHouse(chHost, chUser, chPass)

	metaPath := getenv("REPORT_DB_PATH", filepath.Join(".", "config", "reports.db"))
	metaStore := meta.NewStore(metaPath)
	defer metaStore.Close()

	srv := api.NewServer(ch, metaStore)
	mux := api.NewMux(srv)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           api.WithCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Backend Service starting on port %s...\n", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Error starting server: %s\n", err)
	}
}

// mustConnectClickHouse establishes a connection to ClickHouse or dies trying.
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

// getenv returns the value of an environment variable or a fallback if empty.
func getenv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}
