package gamesapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
)

type progressionAccounts struct{}

func (progressionAccounts) AuthState(_ context.Context, username string) (bool, int64, error) {
	return username == "alice" || username == "bob", 0, nil
}

func sessionToken(secret, sub string, exp time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + sub + `","sv":0,"exp":` + strconv.FormatInt(exp.Unix(), 10) + `}`))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(header + "." + payload))
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestChroniclesProgressionFollowsTheAccount(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "0123456789abcdef0123456789abcdef"
	h, err := NewChroniclesProgression(ChroniclesProgressionConfig{
		Config:      Config{Accounts: progressionAccounts{}, JWTSecret: secret, Now: func() time.Time { return now }},
		Progression: chroniclesprogression.NewMemory(),
	})
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, user, body string) (int, map[string]any) {
		req := httptest.NewRequest(method, ChroniclesProgressionPattern, strings.NewReader(body))
		if user != "" {
			req.Header.Set("Authorization", "Bearer "+sessionToken(secret, user, now.Add(time.Hour)))
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		out := map[string]any{}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}

	if code, _ := call(http.MethodGet, "", ""); code != http.StatusUnauthorized {
		t.Fatalf("anonymous GET = %d", code)
	}
	code, out := call(http.MethodGet, "alice", "")
	if code != http.StatusOK || out["progression"] != nil || out["revision"].(float64) != 0 {
		t.Fatalf("empty GET = %d %v", code, out)
	}
	code, out = call(http.MethodPut, "alice", `{"progression":{"version":1,"heroes":{"matthias":{"xp":40}}},"baseRevision":0}`)
	if code != http.StatusOK || out["revision"].(float64) != 1 {
		t.Fatalf("first PUT = %d %v", code, out)
	}
	// Another device still on revision 0 is told what the server holds.
	code, out = call(http.MethodPut, "alice", `{"progression":{"version":1},"baseRevision":0}`)
	if code != http.StatusConflict || out["revision"].(float64) != 1 {
		t.Fatalf("stale PUT = %d %v", code, out)
	}
	heroes := out["progression"].(map[string]any)["heroes"].(map[string]any)
	if heroes["matthias"].(map[string]any)["xp"].(float64) != 40 {
		t.Fatalf("conflict body lost the stored progression: %v", out)
	}
	// Each account sees only its own.
	if _, other := call(http.MethodGet, "bob", ""); other["progression"] != nil {
		t.Fatalf("bob sees alice's progression: %v", other)
	}
	for _, bad := range []string{`{"progression":[1,2],"baseRevision":1}`, `{"progression":{"a":1}}`, `not json`} {
		if code, _ := call(http.MethodPut, "alice", bad); code != http.StatusUnprocessableEntity {
			t.Fatalf("bad body %q = %d", bad, code)
		}
	}
	big := `{"progression":{"pad":"` + strings.Repeat("x", chroniclesprogression.MaxDocumentBytes) + `"},"baseRevision":1}`
	if code, _ := call(http.MethodPut, "alice", big); code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized PUT = %d", code)
	}
}
