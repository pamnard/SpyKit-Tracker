package api

import (
	"encoding/json"
	"log"
	"net/http"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"

	"github.com/pamnard/pixel/backend/internal/meta"
)

// Server bundles data sources and handlers for the HTTP API.
type Server struct {
	ch        clickhouse.Conn
	metaStore *meta.Store
}

// NewServer wires dependencies for HTTP handlers.
func NewServer(ch clickhouse.Conn, metaStore *meta.Store) *Server {
	s := &Server{
		ch:        ch,
		metaStore: metaStore,
	}
	s.EnsureAdminUser()
	return s
}

// NewMux registers all HTTP routes for the API.
func NewMux(s *Server) *http.ServeMux {
	mux := http.NewServeMux()

	// Public
	mux.HandleFunc("/", s.handleRoot)
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/settings", s.handleSettingsWrapper) // GET public, PUT protected

	// Protected
	mux.Handle("/api/reports", s.AuthMiddleware(http.HandlerFunc(s.handleReports)))
	mux.Handle("/api/reports/", s.AuthMiddleware(http.HandlerFunc(s.handleReportByID)))
	mux.Handle("/api/widgets", s.AuthMiddleware(http.HandlerFunc(s.handleWidgets)))
	mux.Handle("/api/widgets/", s.AuthMiddleware(http.HandlerFunc(s.handleWidgetData)))
	mux.Handle("/api/schema", s.AuthMiddleware(http.HandlerFunc(s.handleSchema)))

	// Users & Settings -> Admins only
	mux.Handle("/api/users", s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(s.handleUsers))))
	// mux.Handle("/api/settings", s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(s.handleSettings)))) // Moved to wrapper
	mux.Handle("/api/schema/views", s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			s.handleListViews(w, r)
		} else if r.Method == http.MethodPost {
			s.handleCreateView(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/schema/views/", s.AuthMiddleware(s.RequireAdmin(http.HandlerFunc(s.handleViewByID))))

	return mux
}

// WithCORS adds permissive CORS headers and handles preflight.
func WithCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// handleRoot handles the root endpoint.
func (s *Server) handleRoot(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("Pixel Backend API v2"))
}

// handleHealth returns 200 OK if the server is running.
func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(true)
	if err := enc.Encode(payload); err != nil {
		log.Printf("writeJSON encode failed: %v", err)
	}
}

// writeJSONError writes a standard error response JSON.
func writeJSONError(w http.ResponseWriter, status int, code string, err error) {
	if err != nil {
		log.Printf("%s: %v", code, err)
	} else {
		log.Printf("%s", code)
	}
	writeJSON(w, status, map[string]any{
		"error":  code,
		"detail": safeErrorString(err),
	})
}

// safeErrorString returns the error message or empty string if nil.
func safeErrorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
