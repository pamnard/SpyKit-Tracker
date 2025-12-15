package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"example.com/spykit-backend/internal/meta"
)

// handleWidgets supports list (GET) and create (POST).
func (s *Server) handleWidgets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list := make([]meta.Widget, 0, len(s.metaStore.Widgets))
		for _, w := range s.metaStore.Widgets {
			list = append(list, w)
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var wgt meta.Widget
		if err := json.NewDecoder(r.Body).Decode(&wgt); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		if err := s.metaStore.SaveWidget(wgt); err != nil {
			writeJSONError(w, http.StatusBadRequest, "widget_invalid", err)
			return
		}
		writeJSON(w, http.StatusCreated, wgt)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleWidgetData runs the widget query and returns the value.
func (s *Server) handleWidgetData(w http.ResponseWriter, r *http.Request) {
	id := filepath.Base(r.URL.Path)
	switch r.Method {
	case http.MethodGet:
		widget, ok := s.metaStore.Widgets[id]
		if !ok {
			writeJSONError(w, http.StatusNotFound, "widget_not_found", nil)
			return
		}

		from, to, err := parseRangeParams(r)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_range", err)
			return
		}

		query, args := applyTimeRangeFilter(widget.Query, from, to)

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		var value uint64
		if err := s.ch.QueryRow(ctx, query, args...).Scan(&value); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "clickhouse_query_failed", err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":    widget.ID,
			"type":  widget.Type,
			"title": widget.Title,
			"value": value,
			"from":  from.Format(time.RFC3339),
			"to":    to.Format(time.RFC3339),
		})
	case http.MethodPut:
		var wgt meta.Widget
		if err := json.NewDecoder(r.Body).Decode(&wgt); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		if wgt.ID == "" {
			wgt.ID = id
		}
		if wgt.ID != id {
			writeJSONError(w, http.StatusBadRequest, "widget_id_mismatch", nil)
			return
		}
		if err := s.metaStore.SaveWidget(wgt); err != nil {
			writeJSONError(w, http.StatusBadRequest, "widget_invalid", err)
			return
		}
		writeJSON(w, http.StatusOK, wgt)
	case http.MethodDelete:
		if err := s.metaStore.DeleteWidget(id); err != nil {
			writeJSONError(w, http.StatusBadRequest, "widget_delete_failed", err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func parseRangeParams(r *http.Request) (time.Time, time.Time, error) {
	to := time.Now().UTC()
	from := to.Add(-24 * time.Hour)

	if raw := r.URL.Query().Get("to"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		to = parsed
	}
	if raw := r.URL.Query().Get("from"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		from = parsed
	}

	if !to.After(from) {
		return time.Time{}, time.Time{}, fmt.Errorf("to must be after from")
	}
	return from, to, nil
}

func applyTimeRangeFilter(query string, from, to time.Time) (string, []any) {
	lower := strings.ToLower(query)
	args := []any{from, to}

	if strings.Contains(query, "{time_filter}") {
		return strings.Replace(query, "{time_filter}", "timestamp BETWEEN ? AND ?", 1), args
	}

	if strings.Contains(lower, " where ") {
		return query + " AND timestamp BETWEEN ? AND ?", args
	}

	return query + " WHERE timestamp BETWEEN ? AND ?", args
}

