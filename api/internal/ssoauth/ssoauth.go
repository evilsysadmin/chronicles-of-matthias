// Package ssoauth lets Chronicles accept the ShadowOps account: Chess
// Studio is the identity provider, and Chronicles only verifies the
// short-lived EdDSA tokens it issues for the audience "chronicles", with
// the public keys it publishes (JWKS). No password, no shared secret.
//
// The verification rules mirror chess-studio's internal/ssoauth exactly.
// Design: shadowops-infra/docs/identity-sso.md.
package ssoauth

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Audience is this game's name in the tokens.
const Audience = "chronicles"

// Each environment trusts its own Chess Studio, never another one.
var issuers = map[string]string{
	"staging":    "https://api-staging.chess-studio.shadowops.dpdns.org",
	"production": "https://api.chess-studio.shadowops.dpdns.org",
}

// IssuerFor is the identity provider of an environment ("" when the
// environment has none: SSO stays off and only local accounts work).
func IssuerFor(environment, override string) string {
	if override = strings.TrimRight(strings.TrimSpace(override), "/"); override != "" {
		return override
	}
	return issuers[strings.ToLower(strings.TrimSpace(environment))]
}

type Claims struct {
	Issuer         string `json:"iss"`
	Audience       string `json:"aud"`
	Subject        string `json:"sub"`
	SessionVersion int64  `json:"sv"`
	IssuedAt       int64  `json:"iat"`
	ExpiresAt      int64  `json:"exp"`
}

// IsToken tells an SSO token (EdDSA) from a local session (HS256) without
// trusting anything in it.
func IsToken(raw string) bool {
	header, _, ok := strings.Cut(raw, ".")
	if !ok {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(header)
	if err != nil {
		return false
	}
	var h struct {
		Alg string `json:"alg"`
	}
	return json.Unmarshal(decoded, &h) == nil && h.Alg == "EdDSA"
}

// Verifier checks tokens against the issuer's published keys, refreshing
// them when an unknown key id appears (at most once a minute).
type Verifier struct {
	issuer  string
	jwksURL string
	client  *http.Client

	mu      sync.Mutex
	keys    map[string]ed25519.PublicKey
	fetched time.Time
}

func NewVerifier(issuer string) *Verifier {
	return &Verifier{
		issuer: issuer, jwksURL: issuer + "/api/identity/jwks",
		client: &http.Client{Timeout: 5 * time.Second},
		keys:   map[string]ed25519.PublicKey{},
	}
}

// NewStaticVerifier trusts fixed keys (tests, or pinning without network).
func NewStaticVerifier(issuer string, keys map[string]ed25519.PublicKey) *Verifier {
	v := NewVerifier(issuer)
	v.keys = keys
	v.fetched = time.Now().Add(100 * 365 * 24 * time.Hour)
	return v
}

var ErrInvalid = errors.New("invalid ShadowOps token")

func (v *Verifier) Verify(ctx context.Context, raw string, now time.Time) (Claims, error) {
	// The independent IdP requires a different, live-freshness verifier. A
	// legacy SSO_ISSUER override must never accept it by signature alone.
	if v.issuer == "https://id-staging.shadowops.dpdns.org" || v.issuer == "https://id.shadowops.dpdns.org" {
		return Claims{}, ErrInvalid
	}
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return Claims{}, ErrInvalid
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(decoded, &header) != nil || header.Alg != "EdDSA" {
		return Claims{}, ErrInvalid
	}
	public, err := v.key(ctx, header.Kid, now)
	if err != nil {
		return Claims{}, err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !ed25519.Verify(public, []byte(parts[0]+"."+parts[1]), signature) {
		return Claims{}, ErrInvalid
	}
	var claims Claims
	decoded, err = base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || json.Unmarshal(decoded, &claims) != nil {
		return Claims{}, ErrInvalid
	}
	if claims.Issuer != v.issuer || claims.Audience != Audience || strings.TrimSpace(claims.Subject) == "" ||
		!now.Before(time.Unix(claims.ExpiresAt, 0)) {
		return Claims{}, ErrInvalid
	}
	return claims, nil
}

// ErrUnavailable means the issuer's keys could not be fetched.
var ErrUnavailable = errors.New("ShadowOps identity provider unavailable")

func (v *Verifier) key(ctx context.Context, kid string, now time.Time) (ed25519.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if key, ok := v.keys[kid]; ok {
		return key, nil
	}
	if now.Sub(v.fetched) < time.Minute {
		return nil, ErrInvalid
	}
	v.fetched = now
	keys, err := v.fetch(ctx)
	if err != nil {
		return nil, ErrUnavailable
	}
	v.keys = keys
	if key, ok := keys[kid]; ok {
		return key, nil
	}
	return nil, ErrInvalid
}

func (v *Verifier) fetch(ctx context.Context) (map[string]ed25519.PublicKey, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "chronicles-api-sso/1")
	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("jwks status " + resp.Status)
	}
	var set struct {
		Keys []struct {
			Kty, Crv, Kid, X string
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&set); err != nil {
		return nil, err
	}
	keys := map[string]ed25519.PublicKey{}
	for _, k := range set.Keys {
		raw, err := base64.RawURLEncoding.DecodeString(k.X)
		if k.Kty == "OKP" && k.Crv == "Ed25519" && err == nil && len(raw) == ed25519.PublicKeySize {
			keys[k.Kid] = ed25519.PublicKey(raw)
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("jwks without Ed25519 keys")
	}
	return keys, nil
}
