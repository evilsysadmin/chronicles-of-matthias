package main

import (
	"net/http"
	"testing"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/gamesapi"
)

// Verify the exact public API surface wired into the standalone executable.
// The backend's native handlers enforce JWT/SSO auth, allowed origins, rate
// limits and admin privileges; an unknown verb/path must never reach them.
func TestChroniclesFeedbackRoutes(t *testing.T) {
	cases := []struct {
		method, path string
		player, admin bool
	}{
		{http.MethodPost, "/api/feedback", true, false},
		{http.MethodGet, "/api/feedback/mine", true, false},
		{http.MethodDelete, "/api/feedback/abc123", true, false},
		{http.MethodGet, "/api/admin/feedback", false, true},
		{http.MethodGet, "/api/admin/feedback/summary", false, true},
		{http.MethodPost, "/api/admin/feedback/abc123/status", false, true},
		{http.MethodPost, "/api/admin/feedback/abc123/reply", false, true},
		{http.MethodGet, "/api/admin/feedback/abc123/attachments/0", false, true},
		{http.MethodDelete, "/api/admin/feedback/abc123", false, true},
		{http.MethodGet, "/api/feedback", false, false},
		{http.MethodPost, "/api/feedback/mine", false, false},
		{http.MethodPost, "/api/admin/feedback", false, false},
		{http.MethodDelete, "/api/feedback/abc123/other", false, false},
		{http.MethodGet, "/api/admin/feedback/abc123", false, false},
	}
	for _, c := range cases {
		t.Run(c.method+" "+c.path, func(t *testing.T) {
			request, err := http.NewRequest(c.method, c.path, nil)
			if err != nil {
				t.Fatal(err)
			}
			_, _, player := gamesapi.FeedbackRoute(request)
			_, admin := gamesapi.AdminFeedbackRoute(request)
			if player != c.player || admin != c.admin {
				t.Fatalf("player=%v admin=%v; want player=%v admin=%v",
					player, admin, c.player, c.admin)
			}
		})
	}
}

func TestChroniclesFeedbackUsesDedicatedCollection(t *testing.T) {
	if chroniclesFeedbackCollection != "feedback" {
		t.Fatalf("userdata.Purge must delete the same collection as the feedback store: %q",
			chroniclesFeedbackCollection)
	}
}
