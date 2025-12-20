package api

import (
	"net/http"
	"os"

	"github.com/pamnard/SpyKit-Tracker/backend/internal/meta"
)

// handleSettings supports GET and PUT for pixel settings.
func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Return settings from environment variables instead of DB
		settings := meta.PixelSettings{
			Endpoint: os.Getenv("PIXEL_ENDPOINT"),
			FileName: os.Getenv("PIXEL_FILENAME"),
		}
		// Fallback to defaults if env vars are missing (should match docker-compose defaults)
		if settings.Endpoint == "" {
			settings.Endpoint = "/track"
		}
		if settings.FileName == "" {
			settings.FileName = "pixel.js"
		}
		writeJSON(w, http.StatusOK, settings)
	case http.MethodPut:
		// Editing settings via API is disabled in favor of environment variables
		writeJSONError(w, http.StatusMethodNotAllowed, "settings_read_only", nil)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleSettingsWrapper handles public GET and protected PUT for settings.
func (s *Server) handleSettingsWrapper(w http.ResponseWriter, r *http.Request) {
	// Allow public GET to support frontend fetching config without auth
	if r.Method == http.MethodGet {
		s.handleSettings(w, r)
		return
	}

	// For any other method (PUT), require authentication and admin role
	adminHandler := s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(s.handleSettings)))
	adminHandler.ServeHTTP(w, r)
}
