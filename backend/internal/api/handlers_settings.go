package api

import (
	"encoding/json"
	"net/http"

	"example.com/spykit-backend/internal/meta"
)

// handleSettings supports GET and PUT for pixel settings.
func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.metaStore.GetSettings())
	case http.MethodPut:
		var settings meta.PixelSettings
		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		// Validate
		if settings.FileName == "" {
			writeJSONError(w, http.StatusBadRequest, "file_name_required", nil)
			return
		}
		if settings.Endpoint == "" {
			writeJSONError(w, http.StatusBadRequest, "endpoint_required", nil)
			return
		}
		if err := s.metaStore.SaveSettings(settings); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "settings_save_failed", err)
			return
		}
		writeJSON(w, http.StatusOK, settings)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleSettingsWrapper handles public GET and protected PUT for settings.
func (s *Server) handleSettingsWrapper(w http.ResponseWriter, r *http.Request) {
	// Allow public GET to support Nginx/Pixel fetching config without auth
	if r.Method == http.MethodGet {
		s.handleSettings(w, r)
		return
	}

	// For any other method (PUT), require authentication and admin role
	// We manually wrap the handler with middlewares
	adminHandler := s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(s.handleSettings)))
	adminHandler.ServeHTTP(w, r)
}
