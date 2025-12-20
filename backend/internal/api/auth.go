package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/pamnard/SpyKit-Tracker/backend/internal/meta"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func init() {
	if len(jwtSecret) == 0 {
		// Fallback only for dev, ideally should panic in prod
		jwtSecret = []byte("super-secret-dev-key")
	}
}

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// handleLogin verifies credentials and issues a JWT.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var creds Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
		return
	}

	// #region agent log
	/*
	func() {
		f, err := os.OpenFile("/app/data/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
		if err == nil {
			defer f.Close()
			users := make([]string, 0, len(s.metaStore.Users))
			for u := range s.metaStore.Users {
				users = append(users, u)
			}
			entry := map[string]any{
				"timestamp":    time.Now().UnixMilli(),
				"location":     "auth.go:handleLogin",
				"message":      "Login attempt",
				"data":         map[string]any{"username": creds.Username, "existing_users": users},
				"sessionId":    "debug-session",
				"runId":        "run2",
				"hypothesisId": "backend_auth",
			}
			json.NewEncoder(f).Encode(entry)
		}
	}()
	*/
	// #endregion

	user, ok := s.metaStore.GetUser(creds.Username)
	if !ok {
		// Timing attack mitigation (dummy check)
		bcrypt.CompareHashAndPassword([]byte("$2a$10$dummy..."), []byte(creds.Password))
		writeJSONError(w, http.StatusUnauthorized, "invalid_credentials", nil)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(creds.Password)); err != nil {
		writeJSONError(w, http.StatusUnauthorized, "invalid_credentials", nil)
		return
	}

	// Generate JWT
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "token_creation_failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"token":    tokenString,
		"username": user.Username,
		"role":     user.Role,
	})
}

// handleUsers CRUD for admin users.
func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// List users (without hashes)
		users := s.metaStore.GetUsers()
		list := make([]meta.User, 0, len(users))
		for _, u := range users {
			u.PasswordHash = "" // Safety first
			list = append(list, u)
		}
		writeJSON(w, http.StatusOK, list)

	case http.MethodPost:
		var u meta.User
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid_json", err)
			return
		}
		if u.Username == "" || u.Password == "" || u.Role == "" {
			writeJSONError(w, http.StatusBadRequest, "missing_fields", nil)
			return
		}

		// Check if exists
		if _, exists := s.metaStore.GetUser(u.Username); exists {
			writeJSONError(w, http.StatusConflict, "user_exists", nil)
			return
		}

		// Hash password
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "hashing_failed", err)
			return
		}
		u.PasswordHash = string(hash)

		if err := s.metaStore.SaveUser(u); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "save_failed", err)
			return
		}

		u.Password = ""
		u.PasswordHash = ""
		writeJSON(w, http.StatusCreated, u)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// AuthMiddleware validates JWT.
func (s *Server) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSONError(w, http.StatusUnauthorized, "missing_token", nil)
			return
		}

		tokenStr := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenStr = authHeader[7:]
		} else {
			writeJSONError(w, http.StatusUnauthorized, "invalid_header_format", nil)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			writeJSONError(w, http.StatusUnauthorized, "invalid_token", err)
			return
		}

		ctx := context.WithValue(r.Context(), "user", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAdmin ensures the user has admin role.
func (s *Server) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value("user").(*Claims)
		if !ok || claims.Role != "admin" {
			writeJSONError(w, http.StatusForbidden, "admins_only", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// EnsureAdminUser creates an initial admin if none exist.
func (s *Server) EnsureAdminUser() {
	if u, ok := s.metaStore.GetUser("admin"); ok && len(u.PasswordHash) > 0 {
		return
	}

	user := os.Getenv("INITIAL_ADMIN_USER")
	pass := os.Getenv("INITIAL_ADMIN_PASSWORD")

	if user == "" || pass == "" {
		fmt.Println("CRITICAL: No users in DB and INITIAL_ADMIN_USER/PASSWORD not set.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}

	admin := meta.User{
		Username:     user,
		PasswordHash: string(hash),
		Role:         "admin",
	}

	if err := s.metaStore.SaveUser(admin); err != nil {
		panic(fmt.Sprintf("Failed to seed admin: %v", err))
	}
	fmt.Printf("Seeded initial admin user: %s\n", user)
}

