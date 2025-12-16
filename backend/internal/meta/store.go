package meta

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	bolt "go.etcd.io/bbolt"
)

// User represents an admin panel user.
type User struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash,omitempty"` // Exported for DB persistence
	Role         string `json:"role"`
	Password     string `json:"password,omitempty"` // Only for input (creating users)
}

// Widget describes a report widget backed by a query.
type Widget struct {
	ID              string `json:"id"`
	Type            string `json:"type"`
	Title           string `json:"title"`
	Description     string `json:"description,omitempty"`
	Query           string `json:"query"`
	Width           string `json:"width,omitempty"`            // "1/3", "1/2", "2/3", "full" or empty (default)
	RefreshInterval int    `json:"refreshInterval,omitempty"`  // in seconds, 0 = no auto refresh
	TimeFrom        string `json:"timeFrom,omitempty"`
	TimeTo          string `json:"timeTo,omitempty"`
}

// Report describes a report layout as list of widget IDs.
type Report struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Widgets []string `json:"widgets"`
}

// ViewMeta maps an internal ID to a ClickHouse table/view name.
type ViewMeta struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// PixelSettings describes pixel.js delivery configuration.
type PixelSettings struct {
	FileName string `json:"fileName"` // e.g., "pixel.js"
	Endpoint string `json:"endpoint"` // e.g., "/track"
}

// Store keeps report/widget metadata in a Bolt DB.
// Data is stored in buckets: widgets, reports, settings, users, views.
type Store struct {
	mu       sync.RWMutex
	db       *bolt.DB
	Widgets  map[string]Widget
	Reports  map[string]Report
	Settings PixelSettings
	Users    map[string]User
	Views    map[string]ViewMeta // ID -> Name mapping
}

const (
	widgetsBucket  = "widgets"
	reportsBucket  = "reports"
	settingsBucket = "settings"
	usersBucket    = "users"
	viewsBucket    = "views"
	settingsKey    = "pixel"
)

// NewStore opens (or creates) the Bolt DB and loads data into memory.
func NewStore(dbPath string) *Store {
	db := mustOpenBolt(dbPath)
	ensureBuckets(db)

	return &Store{
		db:       db,
		Widgets:  loadWidgets(db),
		Reports:  loadReports(db),
		Settings: loadSettings(db),
		Users:    loadUsers(db),
		Views:    loadViews(db),
	}
}

// Close closes the underlying Bolt DB.
func (s *Store) Close() error {
	return s.db.Close()
}

func mustOpenBolt(path string) *bolt.DB {
	db, err := bolt.Open(path, 0o644, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		panic(fmt.Sprintf("bolt open failed (%s): %v", path, err))
	}
	return db
}

func ensureBuckets(db *bolt.DB) {
	err := db.Update(func(tx *bolt.Tx) error {
		buckets := []string{widgetsBucket, reportsBucket, settingsBucket, usersBucket, viewsBucket}
		for _, bucket := range buckets {
			if _, err := tx.CreateBucketIfNotExists([]byte(bucket)); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		panic(fmt.Sprintf("bolt ensure buckets failed: %v", err))
	}
}

func loadWidgets(db *bolt.DB) map[string]Widget {
	out := make(map[string]Widget)
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(widgetsBucket))
		return b.ForEach(func(k, v []byte) error {
			var w Widget
			if err := json.Unmarshal(v, &w); err != nil {
				return err
			}
			out[w.ID] = w
			return nil
		})
	})
	if err != nil {
		panic(fmt.Sprintf("bolt load widgets failed: %v", err))
	}
	return out
}

func loadReports(db *bolt.DB) map[string]Report {
	out := make(map[string]Report)
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(reportsBucket))
		return b.ForEach(func(k, v []byte) error {
			var r Report
			if err := json.Unmarshal(v, &r); err != nil {
				return err
			}
			out[r.ID] = r
			return nil
		})
	})
	if err != nil {
		panic(fmt.Sprintf("bolt load reports failed: %v", err))
	}
	return out
}

func loadSettings(db *bolt.DB) PixelSettings {
	defaults := PixelSettings{
		FileName: "pixel.js",
		Endpoint: "/track",
	}
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(settingsBucket))
		v := b.Get([]byte(settingsKey))
		if v == nil {
			return nil // Use defaults
		}
		return json.Unmarshal(v, &defaults)
	})
	if err != nil {
		panic(fmt.Sprintf("bolt load settings failed: %v", err))
	}
	return defaults
}

func loadUsers(db *bolt.DB) map[string]User {
	out := make(map[string]User)
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(usersBucket))
		return b.ForEach(func(k, v []byte) error {
			var u User
			if err := json.Unmarshal(v, &u); err != nil {
				return err
			}
			out[u.Username] = u
			return nil
		})
	})
	if err != nil {
		panic(fmt.Sprintf("bolt load users failed: %v", err))
	}
	return out
}

func loadViews(db *bolt.DB) map[string]ViewMeta {
	out := make(map[string]ViewMeta)
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(viewsBucket))
		return b.ForEach(func(k, v []byte) error {
			var vm ViewMeta
			if err := json.Unmarshal(v, &vm); err != nil {
				return err
			}
			out[vm.ID] = vm
			return nil
		})
	})
	if err != nil {
		panic(fmt.Sprintf("bolt load views failed: %v", err))
	}
	return out
}

// GetSettings returns a copy of current settings.
func (s *Store) GetSettings() PixelSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Settings
}

// GetWidgets returns a list of all widgets.
func (s *Store) GetWidgets() []Widget {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]Widget, 0, len(s.Widgets))
	for _, w := range s.Widgets {
		list = append(list, w)
	}
	return list
}

// GetWidget returns a widget by ID.
func (s *Store) GetWidget(id string) (Widget, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w, ok := s.Widgets[id]
	return w, ok
}

// GetReports returns a list of all reports.
func (s *Store) GetReports() []Report {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]Report, 0, len(s.Reports))
	for _, r := range s.Reports {
		list = append(list, r)
	}
	return list
}

// GetReport returns a report by ID.
func (s *Store) GetReport(id string) (Report, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.Reports[id]
	return r, ok
}

// GetUsers returns a list of all users.
func (s *Store) GetUsers() []User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]User, 0, len(s.Users))
	for _, u := range s.Users {
		list = append(list, u)
	}
	return list
}

// GetUser returns a user by username.
func (s *Store) GetUser(username string) (User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.Users[username]
	return u, ok
}

// GetViews returns a list of all views.
func (s *Store) GetViews() []ViewMeta {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]ViewMeta, 0, len(s.Views))
	for _, v := range s.Views {
		list = append(list, v)
	}
	return list
}

// GetView returns a view by ID.
func (s *Store) GetView(id string) (ViewMeta, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.Views[id]
	return v, ok
}

// SaveWidget upserts a widget in Bolt and refreshes in-memory cache.
func (s *Store) SaveWidget(w Widget) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if w.ID == "" {
		return fmt.Errorf("widget id required")
	}
	if w.Type == "" {
		return fmt.Errorf("widget type required")
	}
	if w.Query == "" {
		return fmt.Errorf("widget query required")
	}
	if w.Title == "" {
		return fmt.Errorf("widget title required")
	}

	payload, err := json.Marshal(w)
	if err != nil {
		return err
	}
	err = s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(widgetsBucket))
		return b.Put([]byte(w.ID), payload)
	})
	if err != nil {
		return err
	}
	s.Widgets[w.ID] = w
	return nil
}

// DeleteWidget removes a widget.
func (s *Store) DeleteWidget(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id == "" {
		return fmt.Errorf("widget id required")
	}
	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(widgetsBucket))
		return b.Delete([]byte(id))
	})
	if err != nil {
		return err
	}
	delete(s.Widgets, id)
	return nil
}

// SaveReport upserts a report. If ID is empty, it generates a new sequence ID.
func (s *Store) SaveReport(r *Report) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if r.Title == "" {
		return fmt.Errorf("report title required")
	}

	// Validate that all referenced widgets exist
	for _, wid := range r.Widgets {
		if _, ok := s.Widgets[wid]; !ok {
			return fmt.Errorf("referenced widget not found: %s", wid)
		}
	}

	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(reportsBucket))
		if r.ID == "" {
			seq, _ := b.NextSequence()
			r.ID = strconv.FormatUint(seq, 10)
		}
		payload, err := json.Marshal(r)
		if err != nil {
			return err
		}
		return b.Put([]byte(r.ID), payload)
	})
	if err != nil {
		return err
	}
	s.Reports[r.ID] = *r
	return nil
}

// DeleteReport removes a report.
func (s *Store) DeleteReport(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id == "" {
		return fmt.Errorf("report id required")
	}
	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(reportsBucket))
		return b.Delete([]byte(id))
	})
	if err != nil {
		return err
	}
	delete(s.Reports, id)
	return nil
}

// SaveSettings updates pixel settings.
func (s *Store) SaveSettings(settings PixelSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	payload, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	err = s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(settingsBucket))
		return b.Put([]byte(settingsKey), payload)
	})
	if err != nil {
		return err
	}
	s.Settings = settings
	return nil
}

// SaveUser upserts a user.
func (s *Store) SaveUser(u User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if u.Username == "" {
		return fmt.Errorf("username required")
	}

	// Prepare for storage (clear plain password)
	storageUser := u
	storageUser.Password = ""

	// Ensure PasswordHash is not empty
	if storageUser.PasswordHash == "" && u.PasswordHash != "" {
		storageUser.PasswordHash = u.PasswordHash
	}

	payload, err := json.Marshal(storageUser)
	if err != nil {
		return err
	}
	err = s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(usersBucket))
		return b.Put([]byte(u.Username), payload)
	})
	if err != nil {
		return err
	}
	s.Users[u.Username] = storageUser
	return nil
}

// DeleteUser removes a user.
func (s *Store) DeleteUser(username string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if username == "" {
		return fmt.Errorf("username required")
	}
	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(usersBucket))
		return b.Delete([]byte(username))
	})
	if err != nil {
		return err
	}
	delete(s.Users, username)
	return nil
}

// SaveViewMeta maps a view internal ID to its ClickHouse name.
func (s *Store) SaveViewMeta(vm *ViewMeta) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if vm.Name == "" {
		return fmt.Errorf("view name required")
	}

	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(viewsBucket))
		if vm.ID == "" {
			seq, _ := b.NextSequence()
			vm.ID = strconv.FormatUint(seq, 10)
		}
		payload, err := json.Marshal(vm)
		if err != nil {
			return err
		}
		return b.Put([]byte(vm.ID), payload)
	})
	if err != nil {
		return err
	}
	s.Views[vm.ID] = *vm
	return nil
}

// DeleteViewMeta removes the view ID mapping.
func (s *Store) DeleteViewMeta(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id == "" {
		return fmt.Errorf("view id required")
	}
	err := s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(viewsBucket))
		return b.Delete([]byte(id))
	})
	if err != nil {
		return err
	}
	delete(s.Views, id)
	return nil
}

// GetViewNameByID retrieves the ClickHouse table name for a given internal view ID.
func (s *Store) GetViewNameByID(id string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.Views[id]
	if !ok {
		return "", false
	}
	return v.Name, true
}
