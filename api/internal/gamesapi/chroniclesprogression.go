package gamesapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
)

// GET/PUT /api/chronicles/progression — the player's Chronicles progression
// (character build, XP, attributes), so it follows the account across
// devices. PUT carries the revision it was based on; a stale write gets 409
// with what the server holds, and the client merges.
const ChroniclesProgressionPattern = "/api/chronicles/progression"

func ChroniclesProgressionRoute(r *http.Request) bool {
	if r.URL.Path != ChroniclesProgressionPattern {
		return false
	}
	method := r.Method
	if method == http.MethodOptions {
		method = preflightMethod(r)
	}
	return method == http.MethodGet || method == http.MethodPut
}

type ChroniclesProgressionConfig struct {
	Config
	Progression chroniclesprogression.Store
}

type ChroniclesProgressionHandler struct {
	base  *Handler
	store chroniclesprogression.Store
	limit *limiter
}

func NewChroniclesProgression(cfg ChroniclesProgressionConfig) (*ChroniclesProgressionHandler, error) {
	if cfg.Progression == nil {
		return nil, errors.New("chronicles progression API needs a store")
	}
	cfg.Store = readOnlyStore{}
	base, err := New(cfg.Config)
	if err != nil {
		return nil, err
	}
	return &ChroniclesProgressionHandler{base: base, store: cfg.Progression, limit: newLimiter(60, time.Minute)}, nil
}

func (h *ChroniclesProgressionHandler) respond(w http.ResponseWriter, status int, record chroniclesprogression.Record) {
	var progression any
	if record.Document != "" {
		progression = json.RawMessage(record.Document)
	}
	writeJSON(w, status, map[string]any{"progression": progression, "revision": record.Revision})
}

func (h *ChroniclesProgressionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !ChroniclesProgressionRoute(r) {
		http.NotFound(w, r)
		return
	}
	b := h.base
	securityHeaders(w)
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	_, allowed := b.origins[origin]
	if r.Method == http.MethodOptions {
		b.preflight(w, r, origin, allowed)
		return
	}
	if origin != "" && allowed {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
		w.Header().Add("Vary", "Origin")
	}
	subject, version, tokenErr := b.verify(r)
	key := "user:" + subject
	if tokenErr != nil {
		key = "ip:" + b.clientIP(r)
	}
	if !h.limit.allow(key, b.now()) {
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "Rate limit exceeded: 60 per 1 minute"})
		return
	}
	username, status, detail := b.currentUser(r, subject, version, tokenErr)
	if status != 0 {
		writeJSON(w, status, map[string]any{"detail": detail})
		return
	}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		record, err := h.store.Get(ctx, username)
		if err != nil {
			storageUnavailable(w)
			return
		}
		h.respond(w, http.StatusOK, record)
		return
	}

	raw, failed := readBody(w, r)
	if failed != 0 {
		return
	}
	var body struct {
		Progression  json.RawMessage `json:"progression"`
		BaseRevision *int64          `json:"baseRevision"`
	}
	if json.Unmarshal(raw, &body) != nil || body.BaseRevision == nil || *body.BaseRevision < 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": "Progresión inválida."})
		return
	}
	doc := bytes.TrimSpace(body.Progression)
	var object map[string]json.RawMessage
	if len(doc) == 0 || doc[0] != '{' || json.Unmarshal(doc, &object) != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"detail": "La progresión debe ser un objeto JSON."})
		return
	}
	if len(doc) > chroniclesprogression.MaxDocumentBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"detail": "Progresión demasiado grande."})
		return
	}
	revision, err := h.store.Put(ctx, username, string(doc), *body.BaseRevision, b.now())
	if errors.Is(err, chroniclesprogression.ErrConflict) {
		current, getErr := h.store.Get(ctx, username)
		if getErr != nil {
			storageUnavailable(w)
			return
		}
		h.respond(w, http.StatusConflict, current)
		return
	}
	if err != nil {
		storageUnavailable(w)
		return
	}
	h.respond(w, http.StatusOK, chroniclesprogression.Record{Document: string(doc), Revision: revision})
}
