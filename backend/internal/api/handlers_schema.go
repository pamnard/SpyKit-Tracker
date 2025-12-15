package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"example.com/spykit-backend/internal/meta"
)

// virtualSchema defines known keys for Map columns to expose them as fields in UI.
var virtualSchema = map[string][]string{
	"ids": {
		"uid", "device_id", "session_id",
	},
	"context": {
		"ip", "user_agent", "url", "referrer",
	},
	"device": {
		"platform", "screen_width", "screen_height", "viewport_width", "viewport_height",
		"color_depth", "pixel_ratio", "orientation", "timezone", "gpu_renderer", "language",
	},
	"geo": {
		"country", "region", "city", "postal_code", "latitude", "longitude", "continent", "metro_code", "timezone",
	},
	"tech": {
		"ad_block", "pdf_viewer", "webdriver",
		// Performance (from JS)
		"ttfb", "domLoad", "fullLoad",
		// Connection (from JS)
		"effectiveType", "downlink", "rtt", "saveData",
	},
	"traffic": {
		"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
	},
}

// handleSchema returns available tables and columns from ClickHouse.
func (s *Server) handleSchema(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := s.ch.Query(ctx, "SELECT table, name, type FROM system.columns WHERE database = currentDatabase()")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "schema_query_failed", err)
		return
	}
	defer rows.Close()

	type Column struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	type Table struct {
		Name    string   `json:"name"`
		Columns []Column `json:"columns"`
	}

	tableMap := make(map[string][]Column)
	for rows.Next() {
		var tableName, colName, colType string
		if err := rows.Scan(&tableName, &colName, &colType); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "schema_scan_failed", err)
			return
		}

		// Add original column
		tableMap[tableName] = append(tableMap[tableName], Column{
			Name: colName,
			Type: colType,
		})

		// Check for virtual fields expansion
		if vFields, ok := virtualSchema[colName]; ok {
			for _, field := range vFields {
				tableMap[tableName] = append(tableMap[tableName], Column{
					Name: colName + "." + field,
					Type: "String", // In Map(String, String) values are strings
				})
			}
		}
	}

	tables := make([]Table, 0, len(tableMap))
	for name, cols := range tableMap {
		tables = append(tables, Table{
			Name:    name,
			Columns: cols,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"tables": tables,
	})
}

// CreateViewRequest defines the payload for creating a view.
type CreateViewRequest struct {
	Name           string `json:"name"`
	Query          string `json:"query"`
	IsMaterialized bool   `json:"is_materialized"`
}

// handleCreateView creates a new View or MaterializedView in ClickHouse and stores metadata.
func (s *Server) handleCreateView(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", nil)
		return
	}

	var req CreateViewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
		return
	}

	// Basic validation for table name to prevent injection
	// Only allow alphanumeric and underscores
	for _, r := range req.Name {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
			writeJSONError(w, http.StatusBadRequest, "invalid_table_name", nil)
			return
		}
	}

	if req.Query == "" {
		writeJSONError(w, http.StatusBadRequest, "empty_query", nil)
		return
	}

	viewType := "VIEW"
	if req.IsMaterialized {
		viewType = "MATERIALIZED VIEW"
	}

	// Construct the DDL
	query := fmt.Sprintf("CREATE %s %s AS %s", viewType, req.Name, req.Query)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := s.ch.Exec(ctx, query); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "create_view_failed", err)
		return
	}

	// Save metadata in BoltDB
	vm := meta.ViewMeta{
		Name: req.Name,
	}
	if err := s.metaStore.SaveViewMeta(&vm); err != nil {
		// Try to cleanup ClickHouse view if meta save fails
		dropQuery := fmt.Sprintf("DROP VIEW IF EXISTS %s", req.Name)
		if req.IsMaterialized {
			dropQuery = fmt.Sprintf("DROP TABLE IF EXISTS %s", req.Name)
		}
		_ = s.ch.Exec(ctx, dropQuery)
		
		writeJSONError(w, http.StatusInternalServerError, "save_meta_failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"id":     vm.ID,
	})
}

// handleListViews returns a list of views (both normal and materialized) enriched with IDs from BoltDB.
func (s *Server) handleListViews(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := s.ch.Query(ctx, "SELECT name, engine FROM system.tables WHERE database = currentDatabase() AND engine IN ('View', 'MaterializedView')")
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "views_query_failed", err)
		return
	}
	defer rows.Close()

	type View struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Engine string `json:"engine"`
	}

	// Create a reverse map for fast lookup: Name -> ID
	nameToID := make(map[string]string)
	for _, vm := range s.metaStore.Views {
		nameToID[vm.Name] = vm.ID
	}

	var views []View
	for rows.Next() {
		var v View
		if err := rows.Scan(&v.Name, &v.Engine); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "views_scan_failed", err)
			return
		}
		// Enrich with ID if exists, otherwise skip or auto-generate (here we skip or show null)
		if id, ok := nameToID[v.Name]; ok {
			v.ID = id
		} else {
			// Optionally auto-register existing views found in CH but not in Bolt
			// For now, let's just assign a temporary empty ID or skip
			// To be consistent with "id from boltdb", we should probably ensure they are synced.
			// But for simplicity, if it's not in Bolt, we can't route by ID easily.
			// Let's create a mapping on the fly? No, that requires write.
			// Just skipping might hide views created manually.
			// Let's assume only managed views are relevant, or expose them without ID.
			continue 
		}
		views = append(views, v)
	}

	writeJSON(w, http.StatusOK, views)
}

// handleViewByID handles GET (show create), PUT (update), and DELETE operations for a specific view by ID.
func (s *Server) handleViewByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/schema/views/")

	// Resolve ID to Name
	oldName, ok := s.metaStore.GetViewNameByID(id)
	if !ok {
		writeJSONError(w, http.StatusNotFound, "view_not_found", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if r.Method == http.MethodDelete {
		var engine string
		// Check table/view type before deleting
		if err := s.ch.QueryRow(ctx, "SELECT engine FROM system.tables WHERE database=currentDatabase() AND name = $1", oldName).Scan(&engine); err != nil {
			// If not found in CH but exists in Bolt, cleanup Bolt
			_ = s.metaStore.DeleteViewMeta(id)
			writeJSONError(w, http.StatusNotFound, "view_not_found_in_db", err)
			return
		}

		dropQuery := ""
		if engine == "View" {
			dropQuery = fmt.Sprintf("DROP VIEW %s", oldName)
		} else if engine == "MaterializedView" {
			dropQuery = fmt.Sprintf("DROP TABLE %s", oldName)
		} else {
			writeJSONError(w, http.StatusBadRequest, "not_a_view", fmt.Errorf("engine is %s", engine))
			return
		}

		if err := s.ch.Exec(ctx, dropQuery); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "drop_failed", err)
			return
		}

		// Cleanup metadata
		if err := s.metaStore.DeleteViewMeta(id); err != nil {
			fmt.Printf("failed to delete view meta for %s: %v\n", id, err)
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
		return
	}

	if r.Method == http.MethodPut {
		var req CreateViewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}

		// Validation
		if req.Name == "" {
			writeJSONError(w, http.StatusBadRequest, "name_required", nil)
			return
		}
		for _, r := range req.Name {
			if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
				writeJSONError(w, http.StatusBadRequest, "invalid_table_name", nil)
				return
			}
		}
		if req.Query == "" {
			writeJSONError(w, http.StatusBadRequest, "empty_query", nil)
			return
		}

		// Check if we are renaming and if target name exists
		if req.Name != oldName {
			var exists int
			if err := s.ch.QueryRow(ctx, "SELECT count() FROM system.tables WHERE database=currentDatabase() AND name = $1", req.Name).Scan(&exists); err == nil && exists > 0 {
				writeJSONError(w, http.StatusConflict, "target_name_exists", nil)
				return
			}
		}

		// Drop old view
		var engine string
		if err := s.ch.QueryRow(ctx, "SELECT engine FROM system.tables WHERE database=currentDatabase() AND name = $1", oldName).Scan(&engine); err != nil {
			writeJSONError(w, http.StatusNotFound, "old_view_not_found", err)
			return
		}
		
		dropQuery := ""
		if engine == "View" {
			dropQuery = fmt.Sprintf("DROP VIEW %s", oldName)
		} else if engine == "MaterializedView" {
			dropQuery = fmt.Sprintf("DROP TABLE %s", oldName)
		}

		if err := s.ch.Exec(ctx, dropQuery); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "drop_failed", err)
			return
		}

		// Create new view
		viewType := "VIEW"
		if req.IsMaterialized {
			viewType = "MATERIALIZED VIEW"
		}
		createQuery := fmt.Sprintf("CREATE %s %s AS %s", viewType, req.Name, req.Query)
		
		if err := s.ch.Exec(ctx, createQuery); err != nil {
			// Try to restore old view? (Complex, skipping for now as per "MVP")
			writeJSONError(w, http.StatusInternalServerError, "create_new_failed_old_dropped", err)
			return
		}

		// Update Metadata if name changed
		if req.Name != oldName {
			vm := meta.ViewMeta{
				ID:   id,
				Name: req.Name,
			}
			if err := s.metaStore.SaveViewMeta(&vm); err != nil {
				// Log error, but DB view is updated
				fmt.Printf("failed to update view meta for %s: %v\n", id, err)
			}
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
		return
	}

	if r.Method == http.MethodGet {
		var statement string
		if err := s.ch.QueryRow(ctx, fmt.Sprintf("SHOW CREATE TABLE %s", oldName)).Scan(&statement); err != nil {
			writeJSONError(w, http.StatusNotFound, "view_not_found_in_db", err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"id":    id,
			"name":  oldName,
			"query": statement,
		})
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}
