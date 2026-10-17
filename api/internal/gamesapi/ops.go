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
