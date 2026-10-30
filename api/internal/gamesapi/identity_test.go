package gamesapi

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
)

type boundAccounts struct{ profiles map[string]string }

func (a *boundAccounts) AuthState(_ context.Context, username string) (bool, int64, error) {
	return username == "alice", 0, nil
}
func (a *boundAccounts) EnsureIdentityUser(_ context.Context, issuer, subject, _ string) (string, error) {
	key := identityauth.ProfilePrefix + subject
	a.profiles[key] = issuer + "\n" + subject
	return key, nil
}

// Only the test transport maps the pinned public hostname onto this TLS fixture.
// Runtime configuration has no endpoint/transport override from a token/user.
type localIdentityTransport struct {
	base   http.RoundTripper
	target *url.URL
}

func (p localIdentityTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	copy := r.Clone(r.Context())
	next := *r.URL
	copy.URL = &next
	copy.URL.Scheme = p.target.Scheme
	copy.URL.Host = p.target.Host
	return p.base.RoundTrip(copy)
}

func TestCentralIdentityJWTEntersChroniclesOnlyWithLiveAuthorityAndBoundProfile(t *testing.T) {
	public, private, _ := ed25519.GenerateKey(nil)
	const subject = "11111111-1111-4111-8111-111111111111"
	now := time.Now().Unix()
	c := identityauth.Claims{Issuer: identityauth.Issuer, Audience: identityauth.Audience, Subject: subject, Version: 1, JTI: base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x66}, 16)), Issued: now, NotBefore: now, Expires: now + 120}
	header, _ := json.Marshal(map[string]string{"alg": "EdDSA", "typ": "JWT", "kid": "fixture"})
	payload, _ := json.Marshal(c)
	message := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	token := message + "." + base64.RawURLEncoding.EncodeToString(ed25519.Sign(private, []byte(message)))
	credential := "soc1_" + base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x44}, 32))
	var mode, checks atomic.Int64
	authority := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/identity/jwks" {
			_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]string{"kty": "OKP", "crv": "Ed25519", "use": "sig", "alg": "EdDSA", "kid": "fixture", "x": base64.RawURLEncoding.EncodeToString(public)}}})
			return
		}
		if r.URL.Path != "/api/identity/freshness" || r.Header.Get("Authorization") != "Bearer "+credential {
			http.NotFound(w, r)
			return
		}
		checks.Add(1)
		if mode.Load() == 1 {
			http.Error(w, "revoked", 401)
			return
		}
		if mode.Load() == 2 {
			http.Error(w, "unavailable", 503)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"issuer": c.Issuer, "audience": c.Audience, "subject": c.Subject, "session_version": c.Version, "token_jti": c.JTI, "checked_at": time.Now().Unix(), "account_active": true, "session_active": true, "token_active": true})
	}))
	defer authority.Close()
	target, _ := url.Parse(authority.URL)
	verifier, err := identityauth.NewStagingVerifierWithClient("staging", credential, &http.Client{Transport: localIdentityTransport{authority.Client().Transport, target}})
	if err != nil {
		t.Fatal(err)
	}
	accounts := &boundAccounts{profiles: make(map[string]string)}
	config := Config{Accounts: accounts, JWTSecret: "0123456789abcdef0123456789abcdef", Identity: verifier}
	h, err := NewChroniclesProgression(ChroniclesProgressionConfig{Config: config, Progression: chroniclesprogression.NewMemory()})
	if err != nil {
		t.Fatal(err)
	}
	get := func(handler http.Handler, token string) int {
		r := httptest.NewRequest("GET", ChroniclesProgressionPattern, nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w.Code
	}
	for range 2 {
		if status := get(h, token); status != 200 {
			t.Fatal("valid central token could not enter Chronicles", status)
		}
	}
	key := identityauth.ProfilePrefix + subject
	if len(accounts.profiles) != 1 || accounts.profiles[key] != identityauth.Issuer+"\n"+subject || checks.Load() != 2 {
		t.Fatal("profile binding changed, repeated identities created or freshness cached")
	}
	mode.Store(1)
	if status := get(h, token); status != 401 {
		t.Fatal("revoked central JWT still entered Chronicles", status)
	}
	mode.Store(2)
	if status := get(h, token); status != 503 {
		t.Fatal("authority outage did not fail closed", status)
	}
	if status := get(h, sessionToken(config.JWTSecret, "alice", time.Now().Add(time.Hour))); status != 200 {
		t.Fatal("legacy local login stopped working", status)
	}
	config.Identity = nil
	disabled, err := NewChroniclesProgression(ChroniclesProgressionConfig{Config: config, Progression: chroniclesprogression.NewMemory()})
	if err != nil {
		t.Fatal(err)
	}
	before := checks.Load()
	if status := get(disabled, token); status != 401 || checks.Load() != before {
		t.Fatal("central issuer activated without explicit verifier", status)
	}
}
