package gamesapi

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/sessionauth"
)

// POST /api/ops/delete-account — staging only. Removes an account and its
// data so the person can register again, for when a staging account can no
// longer be recovered (no email recovery on staging). Authorised by an
// operator token minted in CI with the API's JWT secret, never by a session.
const (
	OpsDeleteAccountPattern = "/api/ops/delete-account"
	opsDeleteAccountPurpose = "ops_delete_account"
)

func OpsRoute(r *http.Request) bool { return r.URL.Path == OpsDeleteAccountPattern }

type OpsAccountStore interface {
	Delete(ctx context.Context, username string) (bool, error)
}

type OpsConfig struct {
	Secret      []byte
	Environment string
	Store       OpsAccountStore
	Purge       Purger
	Now         func() time.Time
}

type OpsHandler struct{ cfg OpsConfig }

func NewOps(cfg OpsConfig) *OpsHandler {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &OpsHandler{cfg: cfg}
}

func (h *OpsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Only staging exposes it; elsewhere the path does not exist.
	if strings.ToLower(strings.TrimSpace(h.cfg.Environment)) != "staging" || h.cfg.Store == nil || h.cfg.Purge == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"detail": "Not Found"})
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"detail": "Method Not Allowed"})
		return
	}
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	subject, ok := sessionauth.VerifyOps(token, opsDeleteAccountPurpose, h.cfg.Secret, h.cfg.Now())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"detail": "Operator token required."})
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1024))
	if err != nil || json.Unmarshal(raw, &body) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"detail": "Invalid body."})
		return
	}
	// The body repeats the target so a token cannot be replayed elsewhere.
	username := strings.ToLower(strings.TrimSpace(body.Username))
	if username == "" || username != subject {
		writeJSON(w, http.StatusBadRequest, map[string]any{"detail": "Username does not match the operator token."})
		return
	}
	ctx := context.WithoutCancel(r.Context())
	purged, err := h.cfg.Purge(ctx, username)
	if err != nil {
		storageUnavailable(w)
		return
	}
	deleted, err := h.cfg.Store.Delete(ctx, username)
	if err != nil {
		storageUnavailable(w)
		return
	}
	log.Printf("ops delete-account username=%s deleted=%t games=%d", username, deleted, purged.Games)
	writeJSON(w, http.StatusOK, map[string]any{"deleted": deleted, "username": username, "deletedGames": purged.Games})
}

// POST /api/ops/import-legacy — staging only. Copies one player's runs and
// hero progression from Chess Studio's staging database (where the game
// lived before it had its own API) into Chronicles' database. Idempotent and
// never overwrites. Authorised like delete-account, with its own purpose.
const (
	OpsImportLegacyPattern = "/api/ops/import-legacy"
	opsImportLegacyPurpose = "ops_import_legacy"
)

func OpsImportLegacyRoute(r *http.Request) bool { return r.URL.Path == OpsImportLegacyPattern }

type OpsAccountLookup interface {
	Exists(ctx context.Context, username string) (bool, error)
}

type OpsImportConfig struct {
	Secret      []byte
	Environment string
	Accounts    OpsAccountLookup
	Import      func(ctx context.Context, username string) (any, error)
	Now         func() time.Time
}

type OpsImportHandler struct{ cfg OpsImportConfig }

func NewOpsImport(cfg OpsImportConfig) *OpsImportHandler {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &OpsImportHandler{cfg: cfg}
}

func (h *OpsImportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if strings.ToLower(strings.TrimSpace(h.cfg.Environment)) != "staging" || h.cfg.Accounts == nil || h.cfg.Import == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"detail": "Not Found"})
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"detail": "Method Not Allowed"})
		return
	}
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	subject, ok := sessionauth.VerifyOps(token, opsImportLegacyPurpose, h.cfg.Secret, h.cfg.Now())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"detail": "Operator token required."})
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1024))
	if err != nil || json.Unmarshal(raw, &body) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"detail": "Invalid body."})
		return
	}
	username := strings.ToLower(strings.TrimSpace(body.Username))
	if username == "" || username != subject {
		writeJSON(w, http.StatusBadRequest, map[string]any{"detail": "Username does not match the operator token."})
		return
	}
	ctx := context.WithoutCancel(r.Context())
	exists, err := h.cfg.Accounts.Exists(ctx, username)
	if err != nil {
		storageUnavailable(w)
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]any{"detail": "That account does not exist in Chronicles yet: register first."})
		return
	}
	result, err := h.cfg.Import(ctx, username)
	if err != nil {
		log.Printf("ops import-legacy username=%s failed: %v", username, err)
		// The operator only sees this through CI; the message carries the
		// failing stage and an error class, never connection details.
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"detail": err.Error()})
		return
	}
	log.Printf("ops import-legacy username=%s result=%+v", username, result)
	writeJSON(w, http.StatusOK, map[string]any{"username": username, "result": result})
}
