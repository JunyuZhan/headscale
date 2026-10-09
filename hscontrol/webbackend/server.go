// Package webbackend implements a small, self-contained web administration
// backend for Headscale.
//
// It is intentionally a SEPARATE process from headscale so that:
//   - The Headscale API key lives only on the server (never in the browser).
//   - Web users, sessions and roles are stored in an independent SQLite database
//     and never touch Headscale's own schema (which uses strict migration
//     digests and must not be mutated by us).
//   - The SPA talks only to this backend; this backend proxies every Headscale
//     operation server-side using the configured API key.
//
// Deployment (see docker-compose.yml): Caddy exposes a single entry, routing
//   /ui/api/*  -> webbackend
//   /ui, /    -> headscale   (headscale keeps serving the static SPA + API)
package webbackend

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// WebUser is a login account for the web console. A web user maps to a Headscale
// user (by name) so that, when role == "user", every proxied Headscale call is
// scoped to that Headscale user. role == "admin" sees and manages everything.
type WebUser struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Username       string    `gorm:"uniqueIndex;size:128" json:"username"`
	PasswordHash   string    `json:"-"`
	HeadscaleUser  string    `json:"headscale_user"` // empty for admin (sees all)
	Role           string    `json:"role"`           // "admin" | "user"
	CreatedAt      time.Time `json:"created_at"`
}

// Session is an authenticated browser session identified by a random token
// stored in an HttpOnly cookie.
type Session struct {
	Token     string    `gorm:"primaryKey" json:"-"`
	UserID    uint      `json:"-"`
	ExpiresAt time.Time `json:"-"`
	CreatedAt time.Time `json:"-"`
}

// Invite is a ledger record of a Pre-Auth Key handed out via the web console.
// Headscale's PreAuthKey itself carries no descriptive metadata (no applicant,
// device or org), so we keep our own traceability record: who it was given to,
// what device, which org, and whether it has been used / expired / revoked.
type Invite struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Applicant    string    `json:"applicant"`     // 申请人
	DeviceDesc   string    `json:"device_desc"`   // 设备描述
	Org          string    `json:"org"`           // 单位
	TargetUser   string    `json:"target_user"`   // 目标 Headscale 用户
	KeyPrefix    string    `json:"key_prefix"`    // 密钥前缀（仅用于辨识）
	Hostname     string    `json:"hostname"`      // 写入 tailscale up --hostname
	CreatedBy    string    `json:"created_by"`    // 谁生成的
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	Status       string    `json:"status"` // unused | used | expired | revoked
}

type Config struct {
	Listen           string
	HeadscaleURL     string
	HeadscaleAPIKey  string
	DBPath           string
	SessionDuration  time.Duration
	BootstrapAdmin   string // "user:pass" created on first run if no users exist
	CookieSecure     bool
	ServerURL        string // public base URL used to build client join commands
}

func LoadConfig() *Config {
	c := &Config{
		Listen:          getenv("WEBUI_LISTEN", ":8090"),
		HeadscaleURL:    getenv("HEADSCALE_URL", "http://localhost:8080"),
		HeadscaleAPIKey: os.Getenv("HEADSCALE_API_KEY"),
		DBPath:          getenv("WEBUI_DB", "webui.db"),
		SessionDuration: 12 * time.Hour,
		BootstrapAdmin:  os.Getenv("WEBUI_BOOTSTRAP_ADMIN"),
		CookieSecure:    os.Getenv("WEBUI_COOKIE_SECURE") != "false",
		ServerURL:       getenv("HEADSCALE_PUBLIC_URL", ""),
	}
	return c
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

type Server struct {
	cfg    *Config
	db     *gorm.DB
	client *http.Client
}

func NewServer(cfg *Config) (*Server, error) {
	if cfg.HeadscaleAPIKey == "" {
		return nil, errors.New("WEBUI_HEADSCALE_API_KEY (HEADSCALE_API_KEY) is required")
	}

	gormDB, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("opening web db: %w", err)
	}
	if err := gormDB.AutoMigrate(&WebUser{}, &Session{}, &Invite{}); err != nil {
		return nil, fmt.Errorf("migrating web db: %w", err)
	}

	s := &Server{
		cfg:    cfg,
		db:     gormDB,
		client: &http.Client{Timeout: 30 * time.Second},
	}

	if err := s.bootstrap(); err != nil {
		return nil, err
	}
	return s, nil
}

// bootstrap creates the initial admin account if none exist yet.
func (s *Server) bootstrap() error {
	var count int64
	if err := s.db.Model(&WebUser{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 || s.cfg.BootstrapAdmin == "" {
		return nil
	}
	parts := strings.SplitN(s.cfg.BootstrapAdmin, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return fmt.Errorf("WEBUI_BOOTSTRAP_ADMIN must be 'user:pass'")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(parts[1]), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	admin := WebUser{
		Username:      parts[0],
		PasswordHash:  string(hash),
		HeadscaleUser: "",
		Role:          "admin",
	}
	if err := s.db.Create(&admin).Error; err != nil {
		return err
	}
	log.Printf("webbackend: created bootstrap admin user %q", parts[0])
	return nil
}

// Handler builds the chi router for the web backend.
func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	r.Post("/ui/api/auth/login", s.handleLogin)
	r.Post("/ui/api/auth/logout", s.handleLogout)
	r.Get("/ui/api/auth/me", s.withSession(s.handleMe))

	r.Group(func(protected chi.Router) {
		protected.Use(middlewareOf(s.withSession))

		// Admin-only web user management.
		protected.Route("/ui/api/admin/webusers", func(rt chi.Router) {
			rt.Use(middlewareOf(s.requireAdmin))
			rt.Get("/", s.handleListWebUsers)
			rt.Post("/", s.handleCreateWebUser)
			rt.Delete("/{id}", s.handleDeleteWebUser)
			rt.Post("/{id}/password", s.handleResetPassword)
		})

		// Admin-only invite ledger (traceability of handed-out keys).
		protected.Route("/ui/api/admin/invites", func(rt chi.Router) {
			rt.Use(middlewareOf(s.requireAdmin))
			rt.Get("/", s.handleListInvites)
		})

		// Self-service: the logged-in user's own devices + key generation.
		protected.Get("/ui/api/me", s.handleSelf)
		protected.Post("/ui/api/me/preauthkey", s.handleCreateSelfKey)
		protected.Post("/ui/api/me/password", s.handleChangePassword)

		// Generic proxy to Headscale /api/v1 with role-based scoping.
		protected.Handle("/ui/api/proxy/*", s.handleProxy())
	})

	return r
}

func (s *Server) Run() error {
	ln, err := net.Listen("tcp", s.cfg.Listen)
	if err != nil {
		return err
	}
	log.Printf("webbackend: listening on %s", s.cfg.Listen)
	return http.Serve(ln, s.Handler())
}

// ---- sessions -------------------------------------------------------------

func (s *Server) newSession(w http.ResponseWriter, user *WebUser) error {
	tok := randomToken()
	sess := Session{Token: tok, UserID: user.ID, ExpiresAt: time.Now().Add(s.cfg.SessionDuration)}
	if err := s.db.Create(&sess).Error; err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "webui_session",
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  sess.ExpiresAt,
	})
	return nil
}

func (s *Server) clearSession(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("webui_session"); err == nil {
		s.db.Where("token = ?", c.Value).Delete(&Session{})
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "webui_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		MaxAge:   -1,
	})
}

func (s *Server) sessionUser(r *http.Request) (*WebUser, error) {
	c, err := r.Cookie("webui_session")
	if err != nil {
		return nil, errors.New("no session")
	}
	var sess Session
	if err := s.db.Where("token = ?", c.Value).First(&sess).Error; err != nil {
		return nil, errors.New("invalid session")
	}
	if sess.ExpiresAt.Before(time.Now()) {
		s.db.Delete(&sess)
		return nil, errors.New("expired session")
	}
	var u WebUser
	if err := s.db.First(&u, sess.UserID).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return &u, nil
}

// withSession loads the session user into the request context and calls next.
func (s *Server) withSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, err := s.sessionUser(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
			return
		}
		ctx := contextWithUser(r.Context(), u)
		next(w, r.WithContext(ctx))
	}
}

// requireAdmin restricts access to admin web users.
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := userFromContext(r.Context())
		if u == nil || u.Role != "admin" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "admin only"})
			return
		}
		next(w, r)
	}
}

// middlewareOf adapts a HandlerFunc-style middleware to chi's Use signature.
func middlewareOf(m func(http.HandlerFunc) http.HandlerFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return m(func(w http.ResponseWriter, r *http.Request) { next.ServeHTTP(w, r) })
	}
}

// ---- auth handlers --------------------------------------------------------

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	var u WebUser
	if err := s.db.Where("username = ?", body.Username).First(&u).Error; err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err := s.newSession(w, &u); err != nil {
		writeError(w, http.StatusInternalServerError, "session error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"username": u.Username, "role": u.Role, "headscale_user": u.HeadscaleUser})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w, r)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u := userFromContext(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"username":       u.Username,
		"role":           u.Role,
		"headscale_user": u.HeadscaleUser,
	})
}

// ---- admin web user handlers ---------------------------------------------

func (s *Server) handleListWebUsers(w http.ResponseWriter, r *http.Request) {
	var users []WebUser
	if err := s.db.Order("id asc").Find(&users).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleCreateWebUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username       string `json:"username"`
		Password       string `json:"password"`
		HeadscaleUser  string `json:"headscale_user"`
		Role           string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password required")
		return
	}
	if body.Role != "admin" && body.Role != "user" {
		body.Role = "user"
	}
	if body.Role == "user" && body.HeadscaleUser == "" {
		writeError(w, http.StatusBadRequest, "headscale_user required for role=user")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash error")
		return
	}
	u := WebUser{
		Username:      body.Username,
		PasswordHash:  string(hash),
		HeadscaleUser: body.HeadscaleUser,
		Role:          body.Role,
	}
	if err := s.db.Create(&u).Error; err != nil {
		writeError(w, http.StatusConflict, "username exists or db error")
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) handleDeleteWebUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.db.Delete(&WebUser{}, id).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleChangePassword lets the logged-in web user change their own password.
func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	u := userFromContext(r.Context())
	var body struct {
		Old string `json:"old"`
		New string `json:"new"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad request")
		return
	}
	if len(body.New) < 6 {
		writeError(w, http.StatusBadRequest, "新密码至少 6 位")
		return
	}
	var dbu WebUser
	if err := s.db.First(&dbu, u.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "user error")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(dbu.PasswordHash), []byte(body.Old)); err != nil {
		writeError(w, http.StatusUnauthorized, "原密码错误")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.New), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash error")
		return
	}
	if err := s.db.Model(&dbu).Update("password_hash", string(hash)).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "update error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleResetPassword lets an admin reset another web user's password.
func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		New string `json:"new"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.New) < 6 {
		writeError(w, http.StatusBadRequest, "新密码至少 6 位")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.New), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash error")
		return
	}
	if err := s.db.Model(&WebUser{}).Where("id = ?", id).Update("password_hash", string(hash)).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "update error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleListInvites returns the full invitation ledger (admin only).
func (s *Server) handleListInvites(w http.ResponseWriter, r *http.Request) {
	var invites []Invite
	if err := s.db.Order("id desc").Find(&invites).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	writeJSON(w, http.StatusOK, invites)
}

// ---- self-service ---------------------------------------------------------

// handleSelf returns the web user's Headscale user and that user's nodes.
func (s *Server) handleSelf(w http.ResponseWriter, r *http.Request) {
	u := userFromContext(r.Context())
	resp := map[string]any{
		"username":       u.Username,
		"role":           u.Role,
		"headscale_user": u.HeadscaleUser,
	}
	if u.Role == "user" && u.HeadscaleUser != "" {
		nodes, err := s.headscaleNodes(u.HeadscaleUser)
		if err != nil {
			resp["nodes_error"] = err.Error()
		} else {
			resp["nodes"] = nodes
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// handleCreateSelfKey generates a Pre-Auth Key for the web user's Headscale
// user and returns it together with ready-to-use join commands / config.
// It also writes an Invite ledger record (applicant / device / org) so admins
// can later trace who each handed-out key was given to.
func (s *Server) handleCreateSelfKey(w http.ResponseWriter, r *http.Request) {
	u := userFromContext(r.Context())
	var body struct {
		Reusable        bool   `json:"reusable"`
		Ephemeral       bool   `json:"ephemeral"`
		ExpirationHours int    `json:"expiration_hours"`
		HeadscaleUser   string `json:"headscale_user"` // admin picks a target user
		Applicant       string `json:"applicant"`      // 申请人
		DeviceDesc      string `json:"device_desc"`    // 设备描述
		Org             string `json:"org"`            // 单位
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.ExpirationHours <= 0 || body.ExpirationHours > 24*30 {
		body.ExpirationHours = 24
	}

	// Determine the target Headscale user for the new key.
	target := u.HeadscaleUser
	if u.Role == "admin" {
		// Admins are not bound to a single Headscale user, so they must pick one.
		if body.HeadscaleUser == "" {
			writeError(w, http.StatusBadRequest, "管理员需先选择目标 Headscale 用户")
			return
		}
		target = body.HeadscaleUser
	} else if u.Role != "user" || u.HeadscaleUser == "" {
		writeError(w, http.StatusForbidden, "only mapped users can self-provision")
		return
	}

	key, err := s.createPreAuthKey(target, body.Reusable, body.Ephemeral, body.ExpirationHours)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create key failed: "+err.Error())
		return
	}

	hostname := sanitizeHostname(body.DeviceDesc)
	// Record the invitation in our own ledger for traceability.
	if err := s.db.Create(&Invite{
		Applicant:    body.Applicant,
		DeviceDesc:   body.DeviceDesc,
		Org:          body.Org,
		TargetUser:   target,
		KeyPrefix:    shorten(key, 16),
		Hostname:     hostname,
		CreatedBy:    u.Username,
		ExpiresAt:    time.Now().Add(time.Duration(body.ExpirationHours) * time.Hour),
		Status:       "unused",
	}).Error; err != nil {
		// Non-fatal: the key was created; ledger is best-effort.
		log.Printf("webbackend: failed to record invite ledger: %v", err)
	}

	serverURL := s.cfg.ServerURL
	if serverURL == "" {
		serverURL = s.cfg.HeadscaleURL
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"key":              key,
		"server_url":       serverURL,
		"headscale_user":   u.HeadscaleUser,
		"commands":         joinCommands(serverURL, key, hostname),
		"expiration_hours": body.ExpirationHours,
	})
}

// ---- Headscale proxy ------------------------------------------------------

// handleProxy forwards to Headscale's /api/v1, injecting the server-side key and
// enforcing role-based scoping so a non-admin can only touch their own user.
// proxyAllowed restricts the generic Headscale proxy to the exact endpoints the
// web UI needs. Anything else (api keys, tailnet settings, DERP config, …) is
// rejected with 403 so a compromised session cannot drive the full Headscale
// API through the web backend. Role scoping in preprocessProxy still applies on
// top of this for non-admin users.
func proxyAllowed(method, rest string) bool {
	switch method {
	case http.MethodGet:
		return rest == "/node" || strings.HasPrefix(rest, "/node/") ||
			rest == "/user" || strings.HasPrefix(rest, "/user/") ||
			rest == "/preauthkey" || rest == "/policy"
	case http.MethodPost:
		return rest == "/preauthkey" || rest == "/preauthkey/expire" || rest == "/policy/check" ||
			strings.HasPrefix(rest, "/node/")
	case http.MethodPut:
		return rest == "/policy"
	case http.MethodDelete:
		return rest == "/preauthkey" || strings.HasPrefix(rest, "/user/") ||
			strings.HasPrefix(rest, "/node/")
	}
	return false
}

func (s *Server) handleProxy() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := userFromContext(r.Context())
		rest := strings.TrimPrefix(r.URL.Path, "/ui/api/proxy")
		if !strings.HasPrefix(rest, "/") {
			rest = "/" + rest
		}

		if !proxyAllowed(r.Method, rest) {
			writeError(w, http.StatusForbidden, "forbidden: proxy endpoint not allowed")
			return
		}

		target := strings.TrimRight(s.cfg.HeadscaleURL, "/") + "/api/v1" + rest

		if err := s.preprocessProxy(r, rest, u.HeadscaleUser, u.Role == "admin"); err != nil {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}

		s.forward(w, r, target)
	}
}

// preprocessProxy rewrites/blocks requests and resolves the Pre-Auth Key user
// (Headscale expects a numeric ID, not a name). For non-admins it also confines
// every call to their own Headscale user.
func (s *Server) preprocessProxy(r *http.Request, rest, hsUser string, isAdmin bool) error {
	// Pre-Auth Key creation needs the numeric user ID (Headscale rejects names).
	if r.Method == http.MethodPost && rest == "/preauthkey" {
		if err := s.resolvePreAuthKeyUser(r, hsUser, isAdmin); err != nil {
			return err
		}
	}

	if isAdmin {
		return nil
	}

	// Scoping for non-admin users.
	switch {
	case r.Method == http.MethodGet && rest == "/user":
		return errors.New("forbidden: user listing requires admin")
	case r.Method == http.MethodPost && rest == "/user":
		return errors.New("forbidden: user creation requires admin")
	case r.Method == http.MethodDelete && rest == "/user":
		return errors.New("forbidden: user deletion requires admin")
	case r.Method == http.MethodGet && rest == "/node":
		r.URL.RawQuery = appendUserFilter(r.URL.RawQuery, hsUser)
	case r.Method == http.MethodGet && rest == "/preauthkey":
		r.URL.RawQuery = appendUserFilter(r.URL.RawQuery, hsUser)
	case r.Method == http.MethodPost && strings.HasPrefix(rest, "/node/"):
		return errors.New("forbidden: node changes require admin")
	case r.Method == http.MethodDelete && strings.HasPrefix(rest, "/node/"):
		return errors.New("forbidden: node deletion requires admin")
	case rest == "/policy":
		return errors.New("forbidden: policy requires admin")
	}
	return nil
}

// resolvePreAuthKeyUser ensures the "user" field is a numeric ID. For non-admins
// it forces the mapped Headscale user; for both roles it turns a name into an ID.
func (s *Server) resolvePreAuthKeyUser(r *http.Request, hsUser string, isAdmin bool) error {
	var body map[string]any
	if raw, err := io.ReadAll(r.Body); err == nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, &body)
	}
	if body == nil {
		body = map[string]any{}
	}
	if !isAdmin {
		body["user"] = hsUser
		// users should not create ephemeral keys by default
		if _, ok := body["ephemeral"]; !ok {
			body["ephemeral"] = false
		}
	}
	if v, ok := body["user"].(string); ok && v != "" {
		if _, err := strconv.ParseUint(v, 10, 64); err != nil {
			id, rerr := s.resolveUserID(v)
			if rerr != nil {
				return rerr
			}
			body["user"] = id
		}
	}
	nb, _ := json.Marshal(body)
	r.Body = io.NopCloser(bytes.NewReader(nb))
	r.ContentLength = int64(len(nb))
	return nil
}

// resolveUserID looks up a Headscale user's numeric ID by name.
func (s *Server) resolveUserID(name string) (string, error) {
	req, err := http.NewRequest(http.MethodGet,
		strings.TrimRight(s.cfg.HeadscaleURL, "/")+"/api/v1/user", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.HeadscaleAPIKey)
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var parsed struct {
		Users []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"users"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}
	for _, u := range parsed.Users {
		if u.Name == name {
			return u.ID, nil
		}
	}
	return "", fmt.Errorf("headscale user not found: %s", name)
}

func appendUserFilter(q, user string) string {
	if user == "" {
		return q
	}
	if q == "" {
		return "user=" + user
	}
	return q + "&user=" + user
}

func (s *Server) forward(w http.ResponseWriter, r *http.Request, target string) {
	var body io.Reader
	if r.Body != nil {
		body = r.Body
	}
	req, err := http.NewRequestWithContext(r.Context(), r.Method, target, body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "proxy error")
		return
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.HeadscaleAPIKey)
	req.Header.Set("Content-Type", "application/json")
	// Preserve query string.
	req.URL.RawQuery = r.URL.RawQuery

	resp, err := s.client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "headscale unreachable: "+err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// Headscale returns HTTP 500 with "acl policy not found" when no ACL policy
	// is configured (policy.mode=database). That is semantically "empty policy",
	// not a server fault, so normalize it to a clean 200 with an empty policy.
	// This keeps the web UI's "no policy yet" template working without a console
	// error.
	if resp.StatusCode == http.StatusInternalServerError &&
		r.Method == http.MethodGet &&
		strings.HasSuffix(r.URL.Path, "/policy") &&
		strings.Contains(string(respBody), "acl policy not found") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"policy":""}`))
		return
	}

	copyHeader(w.Header(), resp.Header)
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

// ---- Headscale helpers ----------------------------------------------------

func (s *Server) headscaleNodes(hsUser string) (any, error) {
	req, err := http.NewRequest(http.MethodGet,
		strings.TrimRight(s.cfg.HeadscaleURL, "/")+"/api/v1/node?user="+hsUser, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.HeadscaleAPIKey)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Server) createPreAuthKey(hsUser string, reusable, ephemeral bool, expHours int) (string, error) {
	// Headscale needs a numeric user ID, not the name.
	userID, err := s.resolveUserID(hsUser)
	if err != nil {
		return "", err
	}
	expiration := time.Now().Add(time.Duration(expHours) * time.Hour).Format(time.RFC3339)
	payload := map[string]any{
		"user":       userID,
		"reusable":   reusable,
		"ephemeral":  ephemeral,
		"expiration": expiration,
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost,
		strings.TrimRight(s.cfg.HeadscaleURL, "/")+"/api/v1/preauthkey", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.HeadscaleAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(data))
	}
	var parsed struct {
		PreAuthKey struct {
			Key string `json:"key"`
		} `json:"preAuthKey"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	if parsed.PreAuthKey.Key == "" {
		return "", fmt.Errorf("no key in response: %s", string(data))
	}
	return parsed.PreAuthKey.Key, nil
}

// joinCommands builds platform-specific Tailscale join commands for the user.
// Each command bundles the client install step so a colleague can run a single
// line to download Tailscale AND auto-join this control server: no web login and
// no manual config import are needed — the authkey + login-server ARE the config.
// When hostname is non-empty it is injected as --hostname so the device shows up
// in the node list under a recognizable name (device ownership at a glance).
func joinCommands(serverURL, key, hostname string) map[string]string {
	up := fmt.Sprintf("tailscale up --login-server %s --authkey %s", serverURL, key)
	if hostname != "" {
		up += " --hostname " + hostname
	}
	linuxMac := "curl -fsSL https://tailscale.com/install.sh | sh && sudo " + up
	windows := "powershell -Command \"Invoke-WebRequest -Uri https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe -OutFile $env:TEMP\\tailscale-setup.exe; " +
		"Start-Process -Wait -FilePath $env:TEMP\\tailscale-setup.exe -ArgumentList '/S'; " +
		"& 'C:\\Program Files\\Tailscale\\tailscale.exe' " + up + "\""
	return map[string]string{
		"linux_macos": linuxMac,
		"windows":     windows,
		"note":        "一行命令：先自动安装 Tailscale 客户端，再用内置令牌自动加入本网络（无需登录后台、无需手动导入配置）。",
	}
}

// sanitizeHostname turns an arbitrary device description into a DNS-safe
// Tailscale hostname (lowercase [a-z0-9-]). Non-ASCII (e.g. Chinese) and spaces
// are dropped/converted to dashes; empty results mean "no hostname".
func sanitizeHostname(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if r == ' ' || r == '_' || r == '.' || r == '-' {
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	if len(out) > 32 {
		out = out[:32]
	}
	return out
}

// shorten returns the first n bytes of s (used for a key prefix preview).
func shorten(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// ---- small utilities ------------------------------------------------------

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": msg})
}

func copyHeader(dst, src http.Header) {
	for k, vv := range src {
		if strings.EqualFold(k, "Content-Length") || strings.EqualFold(k, "Transfer-Encoding") {
			continue
		}
		dst[k] = vv
	}
}
