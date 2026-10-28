package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRosterPolicyAndDataDisclosure(t *testing.T) {
	calls := 0
	h := &adminRosterHandler{
		origins: map[string]bool{"https://staging.chronicles.shadowops.dpdns.org": true},
		authorize: func(r *http.Request) int {
			switch r.Header.Get("Authorization") {
			case "Bearer owner":
				return http.StatusOK
			case "Bearer player":
				return http.StatusForbidden
			default:
				return http.StatusUnauthorized
			}
		},
		read: func(_ context.Context, after string) (rosterPage, error) {
			calls++
			if after != "" && after != "alice" {
				t.Fatalf("unexpected cursor %q", after)
			}
			return rosterPage{Users: []rosterUser{
				{Username: "alice", Online: true, MapID: "swordhaven-first-book",
					Levels: map[string]int{"matthias": 3}},
			}, NextAfter: ""}, nil
		},
	}
	for _, auth := range []string{"", "Bearer player"} {
		r := httptest.NewRequest(http.MethodGet, adminRosterPath, nil)
		r.Header.Set("Authorization", auth)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		want := http.StatusUnauthorized
		if auth != "" { want = http.StatusForbidden }
		if w.Code != want { t.Fatalf("auth=%q status=%d want=%d", auth, w.Code, want) }
	}
	if calls != 0 { t.Fatal("unauthorized roster access queried storage") }
	r := httptest.NewRequest(http.MethodGet, adminRosterPath+"?after=alice", nil)
	r.Header.Set("Authorization", "Bearer owner")
	r.Header.Set("Origin", "https://staging.chronicles.shadowops.dpdns.org")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK || calls != 1 {
		t.Fatalf("roster response status=%d reads=%d", w.Code, calls)
	}
	if w.Header().Get("Cache-Control") != "no-store" { t.Fatal("roster must not be cached") }
	if w.Header().Get("Access-Control-Allow-Origin") == "" { t.Fatal("allowed CORS missing") }
	var page rosterPage
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil { t.Fatal(err) }
	if len(page.Users) != 1 || page.Users[0].Levels["matthias"] != 3 { t.Fatal("missing safe player summary") }
	for _, sensitive := range []string{"password", "clientIp", "email", "inventory", "worldFlags", "coordinate"} {
		if strings.Contains(w.Body.String(), sensitive) { t.Fatalf("leaked %q", sensitive) }
	}
}

func TestRosterBadOriginAndCursorFailBeforeStorage(t *testing.T) {
	calls := 0
	h := &adminRosterHandler{
		origins: map[string]bool{"https://chronicles.shadowops.dpdns.org": true},
		authorize: func(*http.Request) int { return http.StatusOK },
		read: func(context.Context, string) (rosterPage, error) {
			calls++; return rosterPage{}, nil
		},
	}
	for _, test := range []struct{ url, origin string; status int }{
		{adminRosterPath, "https://attacker.example", http.StatusForbidden},
		{adminRosterPath+"?after=%0A", "", http.StatusBadRequest},
		{adminRosterPath+"?after="+strings.Repeat("x",65), "", http.StatusBadRequest},
	} {
		r := httptest.NewRequest(http.MethodGet, test.url, nil)
		r.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != test.status { t.Fatalf("url=%q code=%d",test.url,w.Code) }
	}
	if calls != 0 { t.Fatal("bad requests reached storage") }
}

func TestRosterLevelsAndOnlineAreConservative(t *testing.T) {
	levels := rosterLevels(`{"heroes":{"matthias":{"level":4},"rook":{"level":3},"bishop":{"level":999},"evil":{"level":12}}}`)
	if len(levels) != 2 || levels["matthias"] != 4 || levels["rook"] != 3 {
		t.Fatalf("unexpected levels %#v", levels)
	}
	if rosterLevels("{") != nil { t.Fatal("malformed progression has no reported level") }
	now := time.Date(2026,10,27,12,0,0,0,time.UTC)
	if !rosterActive(now.Add(-120*time.Second).Format(time.RFC3339),true,now) { t.Fatal("recent player not online") }
	if rosterActive(now.Add(-160*time.Second).Format(time.RFC3339),true,now) { t.Fatal("stale player considered online") }
	if rosterActive(now.Format(time.RFC3339),false,now) { t.Fatal("explicit logout ignored") }
	if rosterActive("",true,now) { t.Fatal("missing activity considered online") }
}

func TestRosterHeroNamesUseOnlySafeSavedCharacterLabels(t *testing.T) {
	raw := `{"characterBuild":{"mode":"custom","characters":[
		{"slotId":"matthias","name":"  Aragorn  "},
		{"slotId":"rook","name":"Éowyn"},
		{"slotId":"bishop","name":"  "},
		{"slotId":"knight","name":"line\nbreak"},
		{"slotId":"unknown","name":"Exposed"}
	]}}`
	names := rosterHeroNames(raw)
	if len(names) != 2 || names["matthias"] != "Aragorn" || names["rook"] != "Éowyn" {
		t.Fatalf("safe custom hero names not extracted: %#v", names)
	}
	for _, excluded := range []string{"bishop", "knight", "unknown"} {
		if _, ok := names[excluded]; ok { t.Fatalf("unsafe or unknown slot exposed: %q", excluded) }
	}
	if rosterHeroNames("{") != nil || rosterHeroNames(`{"characterBuild":{}}`) != nil {
		t.Fatal("legacy or corrupt progression must use UI fallback labels")
	}
	if rosterHeroNames(`{"characterBuild":{"characters":[{"slotId":"matthias","name":"` +
		strings.Repeat("x", 25) + `"}]}}`) != nil {
		t.Fatal("names longer than the character creation limit must be ignored")
	}
}

func TestRosterExplicitAdminIgnoresWildcard(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "*, alice")
	if explicitRosterAdmin("random-player") { t.Fatal("wildcard grants access to private player roster") }
	if !explicitRosterAdmin("ALICE") { t.Fatal("explicitly nominated admin denied") }
}

func TestRosterPreflightPermitsClientReleaseHeader(t *testing.T) {
	const origin = "https://staging.chronicles.shadowops.dpdns.org"
	h := &adminRosterHandler{origins: map[string]bool{origin: true}}
	r := httptest.NewRequest(http.MethodOptions, adminRosterPath, nil)
	r.Header.Set("Origin", origin)
	r.Header.Set("Access-Control-Request-Method", "GET")
	r.Header.Set("Access-Control-Request-Headers", "authorization,x-request-id,x-client-release")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight status=%d, want 204", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != origin {
		t.Fatalf("preflight allow-origin=%q, want %q", got, origin)
	}
	allowed := strings.ToLower(w.Header().Get("Access-Control-Allow-Headers"))
	for _, required := range []string{"authorization", "x-request-id", "x-client-release"} {
		if !strings.Contains(allowed, required) {
			t.Fatalf("preflight missing %q in allow-headers=%q", required, allowed)
		}
	}
}
