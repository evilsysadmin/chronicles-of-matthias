// Package gamesapi supplies shared request authentication, rate limiting,
// CORS, and JSON/error helpers for the independent Chronicles Go API.
// Chess Studio's native /api/games list/get/delete endpoints are not routed
// by Chronicles; the shared handlers here remain responsible for auth and
// request-level safeguards.
package gamesapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/corspolicy"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/sessionauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/ssoauth"
)

func preflightMethod(r *http.Request) string {
	return strings.ToUpper(strings.TrimSpace(r.Header.Get("Access-Control-Request-Method")))
}

// Accounts answers users_store.get_auth_state.
type Accounts interface {
	AuthState(ctx context.Context, username string) (exists bool, sessionVersion int64, err error)
}

// Presence records activity (main._touch_activity_best_effort).
type Presence interface {
	Touch(r *http.Request, username string)
}

type Config struct {
	Accounts       Accounts
	Presence       Presence
	JWTSecret      string
	AllowedOrigins []string
	// RatePerMinute is slowapi's default_limits ("120/minute"); 0 uses 120.
	RatePerMinute int
	// TrustCloudflare mirrors _trust_cloudflare_client_ip: anonymous requests
	// are limited per CF-Connecting-IP, not per edge peer (every visitor would
	// share the nginx/sidecar address otherwise).
	TrustCloudflare bool
	Now             func() time.Time
	// SSO accepts ShadowOps account tokens (Chess Studio as identity
	// provider) besides local sessions; nil keeps local sessions only.
	SSO *ssoauth.Verifier
	// Identity is an explicit staging-only independent IdP verifier. It checks
	// live freshness on every protected request; nil keeps that issuer disabled.
	Identity *identityauth.Verifier
}

type Handler struct {
	accounts Accounts
	presence Presence
	secret   []byte
	origins  map[string]struct{}
	limiter  *limiter
	now      func() time.Time
	trustCF  bool
	sso      *ssoauth.Verifier
	identity *identityauth.Verifier
}

func New(cfg Config) (*Handler, error) {
	if cfg.Accounts == nil {
		return nil, errors.New("chronicles API needs accounts")
	}
	secret := strings.TrimSpace(cfg.JWTSecret)
	if secret == "" {
		return nil, errors.New("games API needs JWT_SECRET")
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	rate := cfg.RatePerMinute
	if rate <= 0 {
		rate = 120
	}
	origins := map[string]struct{}{}
	for _, raw := range append(corspolicy.CanonicalBrowserOrigins(), cfg.AllowedOrigins...) {
		if origin := normalizeOrigin(raw); origin != "" {
			origins[origin] = struct{}{}
		}
	}
	return &Handler{
		accounts: cfg.Accounts,
		presence: cfg.Presence,
		secret:   []byte(secret),
		origins:  origins,
		limiter:  newLimiter(rate, time.Minute),
		trustCF:  cfg.TrustCloudflare,
		now:      now,
		sso:      cfg.SSO,
		identity: cfg.Identity,
	}, nil
}

func (h *Handler) verify(r *http.Request) (string, int64, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", 0, errMissingToken
	}
	raw := header[len("Bearer "):]
	if identityauth.Recognizes(raw) {
		if h.identity == nil {
			return "", 0, identityauth.ErrInvalid
		}
		claims, err := h.identity.Verify(r.Context(), raw, h.now())
		if err != nil {
			return "", 0, err
		}
		return claims.ProfileKey(), identitySessionVersion, nil
	}
	if h.sso != nil && ssoauth.IsToken(raw) {
		claims, err := h.sso.Verify(r.Context(), raw, h.now())
		if err != nil {
			return "", 0, err
		}
		if identityauth.IsReservedProfileKey(claims.Subject) {
			return "", 0, identityauth.ErrInvalid
		}
		return claims.Subject, ssoSessionVersion, nil
	}
	subject, version, err := sessionauth.VerifySession(raw, h.secret, h.now())
	if identityauth.IsReservedProfileKey(subject) {
		return "", 0, identityauth.ErrInvalid
	}
	return subject, version, err
}

// ssoSessionVersion marks a subject vouched for by the identity provider:
// the IdP checked its own session version when it issued the token (it
// lives an hour), so the local one does not apply.
const ssoSessionVersion int64 = -1
const identitySessionVersion int64 = -2

type IdentityAccounts interface {
	EnsureIdentityUser(ctx context.Context, issuer, subject, createdAt string) (string, error)
}

// SSOAccounts creates the local record of a ShadowOps account the first
// time it plays here (no password: it signs in through the IdP).
type SSOAccounts interface {
	EnsureSSOUser(ctx context.Context, username, createdAt string) error
}

var errMissingToken = errors.New("missing token")

// currentUser mirrors main.get_current_user.
func (h *Handler) currentUser(r *http.Request, subject string, version int64, tokenErr error) (string, int, string) {
	if errors.Is(tokenErr, errMissingToken) {
		return "", http.StatusUnauthorized, "Falta el token de sesión."
	}
	if tokenErr != nil {
		if errors.Is(tokenErr, identityauth.ErrUnavailable) {
			return "", http.StatusServiceUnavailable, "No se puede verificar tu sesión ShadowOps temporalmente."
		}
		return "", http.StatusUnauthorized, "Sesión inválida o expirada. Inicia sesión de nuevo."
	}
	if version == identitySessionVersion {
		ensure, capable := h.accounts.(IdentityAccounts)
		centralSubject, valid := identityauth.SubjectForProfileKey(subject)
		if !capable || !valid {
			return "", http.StatusUnauthorized, "Cuenta ShadowOps no admitida aquí."
		}
		profile, err := ensure.EnsureIdentityUser(r.Context(), identityauth.Issuer, centralSubject, h.now().UTC().Format(time.RFC3339))
		if err != nil || profile != subject {
			return "", http.StatusServiceUnavailable, "No se puede verificar el perfil temporalmente."
		}
		return profile, 0, ""
	}
	if version == ssoSessionVersion {
		ensure, ok := h.accounts.(SSOAccounts)
		if !ok {
			return "", http.StatusUnauthorized, "Cuenta ShadowOps no admitida aquí."
		}
		if err := ensure.EnsureSSOUser(r.Context(), subject, h.now().UTC().Format(time.RFC3339)); err != nil {
			return "", http.StatusServiceUnavailable, "No se puede verificar la sesión temporalmente."
		}
		return subject, 0, ""
	}
	exists, accountVersion, err := h.accounts.AuthState(r.Context(), subject)
	if err != nil {
		return "", http.StatusServiceUnavailable, "No se puede verificar la sesión temporalmente."
	}
	if !exists || accountVersion != version {
		return "", http.StatusUnauthorized, "La cuenta ya no existe."
	}
	return subject, 0, ""
}

// The CORSMiddleware configuration in main.py, as Starlette expands it
// (the CORS-safelisted headers are always allowed).
var (
	corsMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
	corsHeaders = []string{"Accept", "Accept-Language", "Authorization", "Content-Language", "Content-Type", "Idempotency-Key", "X-API-Key", "X-Chronicles-Party-Level", "X-Client-Release", "X-Presence-Session", "X-Request-ID"}
)

// preflight mirrors Starlette's CORSMiddleware.preflight_response: a 400 with
// the reasons when the origin, method or a requested header is not allowed.
func (h *Handler) preflight(w http.ResponseWriter, r *http.Request, origin string, allowed bool) {
	hdr := w.Header()
	hdr.Add("Vary", "Origin")
	hdr.Set("Access-Control-Allow-Methods", corsMethods)
	hdr.Set("Access-Control-Allow-Headers", strings.Join(corsHeaders, ", "))
	hdr.Set("Access-Control-Max-Age", "600")
	var failures []string
	if allowed {
		hdr.Set("Access-Control-Allow-Origin", origin)
	} else {
		failures = append(failures, "origin")
	}
	if !strings.Contains(", "+corsMethods+", ", ", "+preflightMethod(r)+", ") {
		failures = append(failures, "method")
	}
	allowedHeaders := map[string]bool{}
	for _, name := range corsHeaders {
		allowedHeaders[strings.ToLower(name)] = true
	}
	for _, requested := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
		if name := strings.ToLower(strings.TrimSpace(requested)); name != "" && !allowedHeaders[name] {
			failures = append(failures, "headers")
			break
		}
	}
	hdr.Set("Content-Type", "text/plain; charset=utf-8")
	if len(failures) > 0 {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("Disallowed CORS " + strings.Join(failures, ", ")))
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

// securityHeaders mirrors main.security_baseline.
func securityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
}

// storageUnavailable mirrors persistent_storage_unavailable_handler.
func storageUnavailable(w http.ResponseWriter) {
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"detail":    "La base de datos no está disponible temporalmente.",
		"requestId": w.Header().Get("X-Request-ID"),
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(payload)
}

// normalizeOrigin mirrors main._normalize_cors_origin.
func normalizeOrigin(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return strings.ToLower(parsed.Scheme) + "://" + strings.ToLower(parsed.Host)
}

// plain turns decoded BSON into the plain maps and lists Python sees.
func plain(value any) any {
	switch v := value.(type) {
	case bson.M:
		out := make(map[string]any, len(v))
		for k, item := range v {
			out[k] = plain(item)
		}
		return out
	case bson.D:
		out := make(map[string]any, len(v))
		for _, e := range v {
			out[e.Key] = plain(e.Value)
		}
		return out
	case bson.A:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = plain(item)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(v))
		for k, item := range v {
			out[k] = plain(item)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = plain(item)
		}
		return out
	}
	return value
}

// clientIP mirrors rate_limit_key's anonymous branch.
func (h *Handler) clientIP(r *http.Request) string {
	if h.trustCF || strings.TrimSpace(r.Header.Get("CF-Ray")) != "" {
		if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); ip != "" {
			return ip
		}
	}
	return remoteHost(r.RemoteAddr)
}

func remoteHost(addr string) string {
	if i := strings.LastIndex(addr, ":"); i > 0 {
		return strings.Trim(addr[:i], "[]")
	}
	return addr
}

// limiter is slowapi's fixed-window default limit, per key, per process.
type limiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	buckets map[string]bucket
}

type bucket struct {
	start time.Time
	count int
}

func newLimiter(limit int, window time.Duration) *limiter {
	return &limiter{limit: limit, window: window, buckets: map[string]bucket{}}
}

func (l *limiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	b := l.buckets[key]
	if b.start.IsZero() || now.Sub(b.start) >= l.window {
		if len(l.buckets) > 10000 {
			for k, old := range l.buckets {
				if now.Sub(old.start) >= l.window {
					delete(l.buckets, k)
				}
			}
		}
		b = bucket{start: now}
	}
	if b.count >= l.limit {
		l.buckets[key] = b
		return false
	}
	b.count++
	l.buckets[key] = b
	return true
}
