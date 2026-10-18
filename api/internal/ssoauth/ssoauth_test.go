package ssoauth

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// sign mirrors chess-studio's ssoauth.Sign (the issuer side).
func sign(t *testing.T, key ed25519.PrivateKey, kid string, claims Claims) string {
	t.Helper()
	header, _ := json.Marshal(map[string]string{"alg": "EdDSA", "typ": "JWT", "kid": kid})
	payload, _ := json.Marshal(claims)
	signing := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	return signing + "." + base64.RawURLEncoding.EncodeToString(ed25519.Sign(key, []byte(signing)))
}

func TestVerifierFetchesTheIssuerKeys(t *testing.T) {
	public, private, _ := ed25519.GenerateKey(nil)
	var fetches atomic.Int32
	idp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/identity/jwks" {
			http.NotFound(w, r)
			return
		}
		fetches.Add(1)
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kty": "OKP", "crv": "Ed25519", "kid": "k1", "x": base64.RawURLEncoding.EncodeToString(public),
		}}})
	}))
	defer idp.Close()

	now := time.Unix(1_800_000_000, 0)
	v := NewVerifier(idp.URL)
	good := Claims{Issuer: idp.URL, Audience: Audience, Subject: "evilsysadmin", ExpiresAt: now.Add(time.Hour).Unix()}
	claims, err := v.Verify(context.Background(), sign(t, private, "k1", good), now)
	if err != nil || claims.Subject != "evilsysadmin" {
		t.Fatalf("verify: %+v %v", claims, err)
	}
	// Known key: no refetch.
	_, _ = v.Verify(context.Background(), sign(t, private, "k1", good), now)
	if fetches.Load() != 1 {
		t.Fatalf("fetches: %d", fetches.Load())
	}
	// An unknown kid refetches at most once a minute.
	_, _ = v.Verify(context.Background(), sign(t, private, "k2", good), now.Add(10*time.Second))
	_, _ = v.Verify(context.Background(), sign(t, private, "k2", good), now.Add(2*time.Minute))
	if fetches.Load() != 2 {
		t.Fatalf("refetches: %d", fetches.Load())
	}

	for name, claims := range map[string]Claims{
		"other issuer":   {Issuer: "https://evil.example", Audience: Audience, Subject: "x", ExpiresAt: good.ExpiresAt},
		"other audience": {Issuer: idp.URL, Audience: "chess", Subject: "x", ExpiresAt: good.ExpiresAt},
		"expired":        {Issuer: idp.URL, Audience: Audience, Subject: "x", ExpiresAt: now.Add(-time.Second).Unix()},
		"no subject":     {Issuer: idp.URL, Audience: Audience, ExpiresAt: good.ExpiresAt},
	} {
		if _, err := v.Verify(context.Background(), sign(t, private, "k1", claims), now); err == nil {
			t.Fatalf("%s accepted", name)
		}
	}
	_, forger, _ := ed25519.GenerateKey(nil)
	if _, err := v.Verify(context.Background(), sign(t, forger, "k1", good), now); err == nil {
		t.Fatal("a token signed with another key was accepted")
	}
}

func TestIsTokenTellsSSOFromLocalSessions(t *testing.T) {
	_, private, _ := ed25519.GenerateKey(nil)
	if !IsToken(sign(t, private, "k", Claims{})) {
		t.Fatal("EdDSA token not recognised")
	}
	hs := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`)) + ".e30.sig"
	if IsToken(hs) || IsToken("garbage") {
		t.Fatal("HS256 or garbage taken for SSO")
	}
}

func TestIssuerPerEnvironment(t *testing.T) {
	if IssuerFor("staging", "") != "https://api-staging.chess-studio.shadowops.dpdns.org" ||
		IssuerFor("production", "") != "https://api.chess-studio.shadowops.dpdns.org" ||
		IssuerFor("ci", "") != "" || IssuerFor("ci", "http://localhost:8000/") != "http://localhost:8000" {
		t.Fatal("issuer table")
	}
}
