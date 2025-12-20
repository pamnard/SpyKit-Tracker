package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"

	"github.com/pamnard/pixel/backend/internal/meta"
)

// handleReports supports list (GET) and create (POST).
func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.metaStore.GetReports())
	case http.MethodPost:
		var rp meta.Report
		if err := json.NewDecoder(r.Body).Decode(&rp); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		// ID is optional for creation; Store will generate one if empty.
		if err := s.metaStore.SaveReport(&rp); err != nil {
			writeJSONError(w, http.StatusBadRequest, "report_invalid", err)
			return
		}
		writeJSON(w, http.StatusCreated, rp)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleReportByID resolves widgets for a report and returns metadata.
func (s *Server) handleReportByID(w http.ResponseWriter, r *http.Request) {
	id := filepath.Base(r.URL.Path)
	switch r.Method {
	case http.MethodGet:
		rp, ok := s.metaStore.GetReport(id)
		if !ok {
			writeJSONError(w, http.StatusNotFound, "report_not_found", nil)
			return
		}
		resolved := make([]meta.Widget, 0, len(rp.Widgets))
		for _, wid := range rp.Widgets {
			widget, ok := s.metaStore.GetWidget(wid)
			if !ok {
				writeJSONError(w, http.StatusInternalServerError, "widget_not_found", nil)
				return
			}
			resolved = append(resolved, widget)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id":      rp.ID,
			"title":   rp.Title,
			"widgets": resolved,
		})
	case http.MethodPut:
		var rp meta.Report
		if err := json.NewDecoder(r.Body).Decode(&rp); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		if rp.ID == "" {
			rp.ID = id
		}
		if rp.ID != id {
			writeJSONError(w, http.StatusBadRequest, "report_id_mismatch", nil)
			return
		}
		if err := s.metaStore.SaveReport(&rp); err != nil {
			writeJSONError(w, http.StatusBadRequest, "report_invalid", err)
			return
		}
		writeJSON(w, http.StatusOK, rp)
	case http.MethodDelete:
		if err := s.metaStore.DeleteReport(id); err != nil {
			writeJSONError(w, http.StatusBadRequest, "report_delete_failed", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

