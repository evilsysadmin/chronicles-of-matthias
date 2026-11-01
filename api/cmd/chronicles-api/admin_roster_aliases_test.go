package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const rosterTestCentral = "shadowops:staging:11111111-1111-4111-8111-111111111111"
const rosterTestSubject = "11111111-1111-4111-8111-111111111111"

type rosterAliasTransport func(*http.Request) (*http.Response, error)

func (fn rosterAliasTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return fn(r)
}

func rosterTestAliasCredential() string {
	return "soa1_" + base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x44}, 32))
}

func rosterTestAliasResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header: http.Header{
			"Content-Type":  []string{"application/json"},
			"Cache-Control": []string{"no-store"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}

func TestRosterAliasConfigurationRequiresExplicitStagingAndIndependentSecret(t *testing.T) {
	valid := rosterTestAliasCredential()
	for _, value := range []string{"", "soc1_" + strings.Repeat("A", 43), "Bearer " + valid, "soa1_" + strings.Repeat("A", 43), "user-password"} {
		if rosterAliasCredentialValid(value) {
			t.Fatalf("accepted invalid alias service credential: %q", value)
		}
	}
	if !rosterAliasCredentialValid(valid) {
		t.Fatal("rejected independent credential")
	}
	if resolver, err := newRosterAliasResolver("production", "", nil); err != nil || resolver != nil {
		t.Fatalf("disabled production alias RPC must remain inert: %v", err)
	}
	for _, environment := range []string{"", "local", "production", "stage"} {
		if resolver, err := newRosterAliasResolver(environment, valid, nil); err == nil || resolver != nil {
			t.Fatalf("allowed privileged alias RPC for environment %q", environment)
		}
	}
	if resolver, err := newRosterAliasResolver("staging", "soc1_"+strings.Repeat("A", 43), nil); err == nil || resolver != nil {
		t.Fatal("accepted existing freshness credential as privileged alias secret")
	}
}

func TestRosterAliasResolverUsesPinnedBackendRPCAndMinimizesDisclosure(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: rosterAliasTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != http.MethodPost || r.URL.String() != rosterAliasURL ||
			r.Header.Get("Authorization") != "Bearer "+rosterTestAliasCredential() ||
			r.Header.Get("Content-Type") != "application/json" ||
			r.Header.Get("Cookie") != "" || r.Header.Get("Origin") != "" {
			t.Fatalf("untrusted or malformed outgoing Identity request: %#v", r)
		}
		var body struct {
			Subjects []string `json:"subjects"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Subjects) != 1 ||
			body.Subjects[0] != rosterTestSubject {
			t.Fatalf("Identity request selected incorrect subjects: %#v err=%v", body, err)
		}
		return rosterTestAliasResponse(200, `{"aliases":{"`+rosterTestSubject+`":"alice","22222222-2222-4222-8222-222222222222":"unrequested"}}`), nil
	})}
	resolve, err := newRosterAliasResolver("staging", rosterTestAliasCredential(), client)
	if err != nil || resolve == nil {
		t.Fatal("staging alias resolver not configured", err)
	}
	page := rosterPage{Users: []rosterUser{
		{Username: rosterTestCentral, Online: true, MapID: "swordhaven-first-book"},
		{Username: "browser-journey-123", Online: false},
		{Username: "shadowops:production:22222222-2222-4222-8222-222222222222", Online: false},
		{Username: "shadowops:staging:wrong", Online: false},
	}, NextAfter: "cursor"}
	resolve(context.Background(), &page)
	if calls != 1 || page.Users[0].AccountAlias != "alice" ||
		page.Users[1].AccountAlias != "" || page.Users[2].AccountAlias != "" ||
		page.Users[3].AccountAlias != "" || page.Users[0].Username != rosterTestCentral ||
		page.NextAfter != "cursor" {
		t.Fatalf("alias resolver changed authorization or unrelated users: calls=%d page=%+v", calls, page)
	}
	resolve(context.Background(), &rosterPage{Users: []rosterUser{{Username: "local"}}})
	if calls != 1 {
		t.Fatal("requested Identity lookup for a local account")
	}
}

func TestRosterAliasFailureNeverDeniesSavedProgressOrLeaksUntrustedNames(t *testing.T) {
	for _, scenario := range []struct {
		name string
		status int
		body string
	}{
		{"unavailable", 503, "identity unavailable"},
		{"unauthorized", 401, "denied"},
		{"malformed", 200, `{"aliases":`},
		{"injected response", 200, `{"aliases":{"` + rosterTestSubject + `":"alice"},"role":"admin"}`},
		{"malicious alias", 200, `{"aliases":{"` + rosterTestSubject + `":"<script>"}}`},
		{"oversized", 200, `{"aliases":{"` + rosterTestSubject + `":"` + strings.Repeat("x", 4500) + `"}}`},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			resolve, err := newRosterAliasResolver("staging", rosterTestAliasCredential(), &http.Client{
				Transport: rosterAliasTransport(func(*http.Request) (*http.Response, error) {
					return rosterTestAliasResponse(scenario.status, scenario.body), nil
				}),
			})
			if err != nil {
				t.Fatal(err)
			}
			page := rosterPage{Users: []rosterUser{{Username: rosterTestCentral, SavedExpeditions: 5, Levels: map[string]int{"matthias": 3}}}}
			resolve(context.Background(), &page)
			if page.Users[0].AccountAlias != "" || page.Users[0].SavedExpeditions != 5 || page.Users[0].Levels["matthias"] != 3 {
				t.Fatalf("Identity failure modified saved player progress: %+v", page)
			}
		})
	}
}

func TestRosterAliasAuthorizationPrecedesDatabaseAndIdentityCalls(t *testing.T) {
	reads, lookups := 0, 0
	h := &adminRosterHandler{
		origins: map[string]bool{},
		authorize: func(r *http.Request) int {
			if r.Header.Get("Authorization") != "Bearer admin" {
				return http.StatusForbidden
			}
			return http.StatusOK
		},
		read: func(context.Context, string) (rosterPage, error) {
			reads++
			return rosterPage{Users: []rosterUser{{Username: rosterTestCentral}}}, nil
		},
		resolveAliases: func(_ context.Context, page *rosterPage) {
			lookups++
			page.Users[0].AccountAlias = "alice"
		},
	}
	unauthorized := httptest.NewRequest(http.MethodGet, adminRosterPath, nil)
	unauthorized.Header.Set("Authorization", "Bearer player")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, unauthorized)
	if w.Code != http.StatusForbidden || reads != 0 || lookups != 0 {
		t.Fatalf("unauthorized census accessed player data: %d/%d/%d", w.Code, reads, lookups)
	}
	authorized := httptest.NewRequest(http.MethodGet, adminRosterPath, nil)
	authorized.Header.Set("Authorization", "Bearer admin")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, authorized)
	if w.Code != http.StatusOK || reads != 1 || lookups != 1 ||
		!strings.Contains(w.Body.String(), `"accountAlias":"alice"`) {
		t.Fatalf("authorized aliases missing: code=%d reads=%d rpc=%d body=%s", w.Code, reads, lookups, w.Body.String())
	}
}
