package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
)

// Redirect only the test transport to an isolated TLS authority. Production
// still pins the central issuer, audience, JWKS and freshness endpoints.
type rosterIdentityTransport struct {
	base http.RoundTripper
	target *url.URL
}

func (t rosterIdentityTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	copy := request.Clone(request.Context())
	next := *request.URL
	next.Scheme, next.Host = t.target.Scheme, t.target.Host
	copy.URL = &next
	return t.base.RoundTrip(copy)
}

func TestCentralIdentityRosterRequiresLiveProofAndExactProductGrant(t *testing.T) {
	const (
		approved = "11111111-1111-4111-8111-111111111111"
		other = "22222222-2222-4222-8222-222222222222"
		origin = "https://staging.chronicles.shadowops.dpdns.org"
	)
	t.Setenv("ADMIN_USERNAMES", "*, "+identityauth.ProfilePrefix+approved)
	public, private, err := ed25519.GenerateKey(nil)
	if err != nil { t.Fatal(err) }
	now := time.Now().Unix()
	credential := "soc1_" + base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x44}, 32))
	claims := func(subject string) identityauth.Claims {
		return identityauth.Claims{
			Issuer: identityauth.Issuer, Audience: identityauth.Audience,
			Subject: subject, Version: 5,
			JTI: base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x33}, 16)),
			Issued: now-1, NotBefore: now-1, Expires: now+90,
		}
	}
	sign := func(c identityauth.Claims, signer ed25519.PrivateKey) string {
		header, _ := json.Marshal(map[string]string{"alg":"EdDSA","typ":"JWT","kid":"fixture"})
		payload, _ := json.Marshal(c)
		message := base64.RawURLEncoding.EncodeToString(header)+"."+base64.RawURLEncoding.EncodeToString(payload)
		return message+"."+base64.RawURLEncoding.EncodeToString(ed25519.Sign(signer, []byte(message)))
	}

	// 0 = active, 1 = revoked, 2 = upstream unavailable.
	var mode, freshCalls, reads atomic.Int64
	authority := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/identity/jwks":
			_ = json.NewEncoder(w).Encode(map[string]any{"keys":[]any{
				map[string]string{"kty":"OKP","crv":"Ed25519","use":"sig","alg":"EdDSA",
					"kid":"fixture","x":base64.RawURLEncoding.EncodeToString(public)},
			}})
		case "/api/identity/freshness":
			if r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer "+credential {
				http.Error(w,"invalid fixture client",http.StatusUnauthorized)
				return
			}
			var request struct {
				Subject string `json:"subject"`
				Version int64 `json:"session_version"`
				JTI string `json:"token_jti"`
			}
			if json.NewDecoder(r.Body).Decode(&request) != nil {
				http.Error(w,"bad request",http.StatusBadRequest)
				return
			}
			freshCalls.Add(1)
			if mode.Load() == 1 {
				http.Error(w,"revoked",http.StatusUnauthorized)
				return
			}
			if mode.Load() == 2 {
				http.Error(w,"unavailable",http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"issuer":identityauth.Issuer,"audience":identityauth.Audience,
				"subject":request.Subject,"session_version":request.Version,"token_jti":request.JTI,
				"checked_at":time.Now().Unix(),
				"account_active":true,"session_active":true,"token_active":true,
			})
		default:
			http.NotFound(w,r)
		}
	}))
	defer authority.Close()
	target, err := url.Parse(authority.URL)
	if err != nil { t.Fatal(err) }
	verifier, err := identityauth.NewStagingVerifierWithClient(
		"staging", credential,
		&http.Client{Transport: rosterIdentityTransport{base: authority.Client().Transport,target: target}},
	)
	if err != nil { t.Fatal(err) }

	h := &adminRosterHandler{
		origins: map[string]bool{origin: true},
		authorize: func(r *http.Request) int {
			return rosterAuthorization(r, []byte(strings.Repeat("k",32)), nil, verifier, nil)
		},
		read: func(context.Context,string)(rosterPage,error) {
			reads.Add(1)
			return rosterPage{Users: []rosterUser{{Username:"fixture"}}},nil
		},
	}
	check := func(token string, want int) {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet,adminRosterPath,nil)
		request.Header.Set("Origin",origin)
		request.Header.Set("Authorization","Bearer "+token)
		result := httptest.NewRecorder()
		h.ServeHTTP(result,request)
		if result.Code != want {
			t.Fatalf("roster status=%d, expected=%d; body=%s",result.Code,want,result.Body.String())
		}
		if result.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("private census response must never be cached")
		}
	}
	ownerToken := sign(claims(approved),private)
	otherToken := sign(claims(other),private)
	check(ownerToken,http.StatusOK)
	if reads.Load() != 1 || freshCalls.Load() != 1 {
		t.Fatal("admin access failed to require exactly one fresh server-side check")
	}
	check(otherToken,http.StatusForbidden) // Legacy wildcard must not authorize a central player.
	if reads.Load() != 1 || freshCalls.Load() != 2 {
		t.Fatal("unapproved central subject reached the census or skipped live freshness")
	}
	mode.Store(1)
	check(ownerToken,http.StatusUnauthorized) // A previously allowed token is now revoked.
	if reads.Load() != 1 || freshCalls.Load() != 3 {
		t.Fatal("revoked owner retained census privileges or freshness was cached")
	}
	mode.Store(2)
	check(ownerToken,http.StatusServiceUnavailable)
	if reads.Load() != 1 || freshCalls.Load() != 4 {
		t.Fatal("Identity outage must fail closed before reading private player data")
	}
	mode.Store(0)
	public2, private2, err := ed25519.GenerateKey(nil)
	if err != nil || bytes.Equal(public2,public) { t.Fatal("invalid independent signature fixture") }
	check(sign(claims(approved),private2),http.StatusUnauthorized)
	if reads.Load() != 1 || freshCalls.Load() != 4 {
		t.Fatal("invalid signature entered privileged path")
	}

	// Removing the private, product-scoped grant must revoke census access,
	// even though the central identity remains correctly authenticated.
	t.Setenv("ADMIN_USERNAMES","*")
	check(ownerToken,http.StatusForbidden)
	if reads.Load() != 1 || freshCalls.Load() != 5 {
		t.Fatal("wildcard re-enabled central admin without an exact product grant")
	}

	// No central verifier means a valid-looking bearer cannot bypass
	// verification by falling back to legacy local-session auth.
	noIdentity := httptest.NewRequest(http.MethodGet,adminRosterPath,nil)
	noIdentity.Header.Set("Authorization","Bearer "+ownerToken)
	if got := rosterAuthorization(noIdentity,[]byte(strings.Repeat("k",32)),nil,nil,nil); got != http.StatusUnauthorized {
		t.Fatalf("central token without verifier returned %d, expected 401",got)
	}
}
