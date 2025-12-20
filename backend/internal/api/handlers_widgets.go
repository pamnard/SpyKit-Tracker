package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/pamnard/pixel/backend/internal/meta"
)

// handleWidgets supports list (GET) and create (POST).
func (s *Server) handleWidgets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.metaStore.GetWidgets())
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

// handleWidgetData runs the widget query and returns the dataset.
func (s *Server) handleWidgetData(w http.ResponseWriter, r *http.Request) {
	id := filepath.Base(r.URL.Path)
	switch r.Method {
	case http.MethodGet:
		widget, ok := s.metaStore.GetWidget(id)
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

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second) // Increased timeout for potentially larger result sets
		defer cancel()

		// Execute query returning multiple rows
		rows, err := s.ch.Query(ctx, query, args...)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "clickhouse_query_failed", err)
			return
		}
		defer rows.Close()

		// Dynamic column scanning
		columns := rows.Columns()
		columnTypes := rows.ColumnTypes()

		count := len(columns)
		values := make([]interface{}, count)

		// Prepare values with correct types based on column types
		for i, ct := range columnTypes {
			dbType := ct.DatabaseTypeName()

			// Special handling for ClickHouse unsigned integers which often cause issues with interface{} scanning
			if strings.Contains(dbType, "UInt64") {
				var v uint64
				values[i] = &v
				continue
			}
			if strings.Contains(dbType, "UInt32") {
				var v uint32
				values[i] = &v
				continue
			}
			if strings.Contains(dbType, "Int64") {
				var v int64
				values[i] = &v
				continue
			}

			// Check ScanType via reflect
			scanType := ct.ScanType()
			if scanType != nil {
				values[i] = reflect.New(scanType).Interface()
			} else {
				// Fallback
				var v interface{}
				values[i] = &v
			}
		}

		// Result set: array of maps
		var results []map[string]interface{}

		for rows.Next() {
			if err := rows.Scan(values...); err != nil {
				writeJSONError(w, http.StatusInternalServerError, "clickhouse_scan_failed", err)
				return
			}

			rowMap := make(map[string]interface{})
			for i, col := range columns {
				// Dereference pointer to get actual value
				val := reflect.ValueOf(values[i]).Elem().Interface()
				rowMap[col] = val
			}
			results = append(results, rowMap)
		}

		if err := rows.Err(); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "clickhouse_rows_error", err)
			return
		}

		// Always return 'data' array.
		// For backward compatibility (if frontend expects 'value'), we can try to extract it from the first row if available.
		// But ideally frontend should migrate to reading 'data'.
		// Let's inspect the first row for a single numeric value to keep old widgets working without frontend changes immediately?
		// Or better: just return the new structure and update frontend. Since user asked for explicit separation.
		
		response := map[string]any{
			"id":    widget.ID,
			"type":  widget.Type,
			"title": widget.Title,
			"data":  results, // Main payload
			"from":  from.Format(time.RFC3339),
			"to":    to.Format(time.RFC3339),
		}

		writeJSON(w, http.StatusOK, response)

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

var sqlClauseRegex = regexp.MustCompile(`(?i)\b(group\s+by|order\s+by|limit|settings)\b`)

func applyTimeRangeFilter(query string, from, to time.Time) (string, []any) {
	// lower := strings.ToLower(query) // Not needed with regex
	args := []any{from, to}

	if strings.Contains(query, "{time_filter}") {
		return strings.Replace(query, "{time_filter}", "timestamp BETWEEN ? AND ?", 1), args
	}

	// Determine where to insert the filter using regex to handle formatting
	loc := sqlClauseRegex.FindStringIndex(query)
	
	cutOff := len(query)
	if loc != nil {
		cutOff = loc[0]
	}

	// Check if there is a WHERE clause in the part before cutOff
	prefix := strings.ToLower(query[:cutOff])
	
	// Simple check for WHERE. Ideally we'd ignore WHERE in string literals/parens, 
	// but for widget queries this heuristic is standard.
	if strings.Contains(prefix, "where") {
		// Append AND before the cutoff
		return query[:cutOff] + " AND timestamp BETWEEN ? AND ? " + query[cutOff:], args
	}

	// Append WHERE before the cutoff
	return query[:cutOff] + " WHERE timestamp BETWEEN ? AND ? " + query[cutOff:], args
}
