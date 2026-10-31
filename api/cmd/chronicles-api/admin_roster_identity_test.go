package main

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
)

func TestRosterCentralSubjectNeedsExplicitGrant(t *testing.T) {
	const first = "11111111-1111-4111-8111-111111111111"
	const second = "22222222-2222-4222-8222-222222222222"
	t.Setenv("ADMIN_USERNAMES", "*, "+identityauth.ProfilePrefix+first)
	if !explicitRosterAdmin(identityauth.ProfilePrefix+first) {
		t.Fatal("explicit product-scoped central grant missing")
	}
	for _, username := range []string{
		identityauth.ProfilePrefix + second,
		first, "evilsysadmin", identityauth.ProfilePrefix + "not-a-uuid",
	} {
		if explicitRosterAdmin(username) {
			t.Fatalf("unreviewed central role granted to %q", username)
		}
	}
}

func TestRosterNeverFallsBackFromCentralTokenToLegacySession(t *testing.T) {
	// The issuer is merely a routing hint, not authentication evidence.
	// A forged token without the live central verifier must always fail.
	claims := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://id-staging.shadowops.dpdns.org","sub":"11111111-1111-4111-8111-111111111111"}`))
	forged := "eyJhbGciOiJFZERTQSJ9." + claims + ".signature"
	if !identityauth.Recognizes(forged) {
		t.Fatal("fixture did not exercise central-token verification branch")
	}
	r := httptest.NewRequest(http.MethodGet, adminRosterPath, nil)
	r.Header.Set("Authorization", "Bearer "+forged)
	if got := rosterAuthorization(r, []byte(strings.Repeat("x", 32)), nil, nil, nil); got != http.StatusUnauthorized {
		t.Fatalf("unconfigured central verifier returned %d, wanted 401", got)
	}
}
