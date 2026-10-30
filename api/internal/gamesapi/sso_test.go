package gamesapi

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/ssoauth"
)

// ssoAccounts knows only local alice; SSO players are created on arrival.
type ssoAccounts struct{ created map[string]bool }

func (a *ssoAccounts) AuthState(_ context.Context, username string) (bool, int64, error) {
	return username == "alice" || a.created[username], 0, nil
}

func TestLegacyAndLocalTokensCannotClaimCentralProfileNamespace(t *testing.T) {
	now := time.Now()
	public, private, _ := ed25519.GenerateKey(nil)
	issuer := "https://api-staging.chess-studio.shadowops.dpdns.org"
	reserved := identityauth.ProfilePrefix + "11111111-1111-4111-8111-111111111111"
	accounts := &ssoAccounts{created: map[string]bool{reserved: true}}
	h, err := NewChroniclesProgression(ChroniclesProgressionConfig{Config: Config{Accounts: accounts, JWTSecret: "0123456789abcdef0123456789abcdef", SSO: ssoauth.NewStaticVerifier(issuer, map[string]ed25519.PublicKey{"k1": public})}, Progression: chroniclesprogression.NewMemory()})
	if err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{
		sessionToken("0123456789abcdef0123456789abcdef", reserved, now.Add(time.Hour)),
		ssoToken(private, ssoauth.Claims{Issuer: issuer, Audience: ssoauth.Audience, Subject: reserved, SessionVersion: 1, ExpiresAt: now.Add(time.Hour).Unix()}),
		ssoToken(private, ssoauth.Claims{Issuer: identityauth.Issuer, Audience: ssoauth.Audience, Subject: "11111111-1111-4111-8111-111111111111", SessionVersion: 1, ExpiresAt: now.Add(time.Minute).Unix()}),
	} {
		r := httptest.NewRequest("GET", ChroniclesProgressionPattern, nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 401 {
			t.Fatal("legacy/local token authenticated a central profile", w.Code)
		}
	}
}

func (a *ssoAccounts) EnsureSSOUser(_ context.Context, username, _ string) error {
	a.created[username] = true
	return nil
}

func ssoToken(key ed25519.PrivateKey, claims ssoauth.Claims) string {
	header, _ := json.Marshal(map[string]string{"alg": "EdDSA", "typ": "JWT", "kid": "k1"})
	payload, _ := json.Marshal(claims)
	signing := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	return signing + "." + base64.RawURLEncoding.EncodeToString(ed25519.Sign(key, []byte(signing)))
}

func TestShadowOpsTokensOpenChronicles(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	public, private, _ := ed25519.GenerateKey(nil)
	issuer := "https://api-staging.chess-studio.shadowops.dpdns.org"
	accounts := &ssoAccounts{created: map[string]bool{}}
	h, err := NewChroniclesProgression(ChroniclesProgressionConfig{
		Config: Config{
			Accounts: accounts, JWTSecret: "0123456789abcdef0123456789abcdef", Now: func() time.Time { return now },
			SSO: ssoauth.NewStaticVerifier(issuer, map[string]ed25519.PublicKey{"k1": public}),
		},
		Progression: chroniclesprogression.NewMemory(),
	})
	if err != nil {
		t.Fatal(err)
	}
	get := func(token string) int {
		req := httptest.NewRequest(http.MethodGet, ChroniclesProgressionPattern, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	claims := ssoauth.Claims{Issuer: issuer, Audience: ssoauth.Audience, Subject: "nuevo", SessionVersion: 7, ExpiresAt: now.Add(time.Hour).Unix()}
	if code := get(ssoToken(private, claims)); code != http.StatusOK || !accounts.created["nuevo"] {
		t.Fatalf("SSO player: %d created=%v", code, accounts.created)
	}
	// Local sessions keep working beside SSO.
	if code := get(sessionToken("0123456789abcdef0123456789abcdef", "alice", now.Add(time.Hour))); code != http.StatusOK {
		t.Fatalf("local session: %d", code)
	}
	other := claims
	other.Audience = "chess"
	_, forger, _ := ed25519.GenerateKey(nil)
	for name, token := range map[string]string{
		"other audience": ssoToken(private, other),
		"forged":         ssoToken(forger, claims),
	} {
		if code := get(token); code != http.StatusUnauthorized {
			t.Fatalf("%s: %d", name, code)
		}
	}
}
