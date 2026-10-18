package gamesapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/userdata"
)

type fakeOpsStore struct{ deleted []string }

func (f *fakeOpsStore) Delete(_ context.Context, username string) (bool, error) {
	f.deleted = append(f.deleted, username)
	return true, nil
}

func opsToken(secret, sub string, exp time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + sub + `","purpose":"ops_delete_account","exp":` + strconv.FormatInt(exp.Unix(), 10) + `}`))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(header + "." + payload))
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestOpsDeleteAccount(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "0123456789abcdef0123456789abcdef"
	store := &fakeOpsStore{}
	purged := []string{}
	handler := func(env string) *OpsHandler {
		return NewOps(OpsConfig{
			Secret: []byte(secret), Environment: env, Store: store, Now: func() time.Time { return now },
			Purge: func(_ context.Context, username string) (userdata.Purged, error) {
				purged = append(purged, username)
				return userdata.Purged{}, nil
			},
		})
	}
	call := func(h http.Handler, token, body string) int {
		req := httptest.NewRequest(http.MethodPost, OpsDeleteAccountPattern, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	good := opsToken(secret, "evilsysadmin", now.Add(5*time.Minute))
	if code := call(handler("production"), good, `{"username":"evilsysadmin"}`); code != http.StatusNotFound {
		t.Fatalf("production must not expose the route: %d", code)
	}
	if code := call(handler("staging"), "", `{"username":"evilsysadmin"}`); code != http.StatusUnauthorized {
		t.Fatalf("missing token: %d", code)
	}
	if code := call(handler("staging"), good, `{"username":"someone-else"}`); code != http.StatusBadRequest {
		t.Fatalf("mismatched username: %d", code)
	}
	if len(store.deleted) != 0 || len(purged) != 0 {
		t.Fatalf("nothing may be deleted on a refused call")
	}
	if code := call(handler("staging"), good, `{"username":"EvilSysAdmin"}`); code != http.StatusOK {
		t.Fatalf("valid call: %d", code)
	}
	if len(store.deleted) != 1 || store.deleted[0] != "evilsysadmin" || purged[0] != "evilsysadmin" {
		t.Fatalf("account not deleted: %v %v", store.deleted, purged)
	}
}

type fakeOpsAccounts map[string]bool

func (f fakeOpsAccounts) Exists(_ context.Context, username string) (bool, error) { return f[username], nil }

func opsTokenFor(secret, sub, purpose string, exp time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + sub + `","purpose":"` + purpose + `","exp":` + strconv.FormatInt(exp.Unix(), 10) + `}`))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(header + "." + payload))
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestOpsImportLegacy(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "0123456789abcdef0123456789abcdef"
	imported := []string{}
	handler := func(env string) *OpsImportHandler {
		return NewOpsImport(OpsImportConfig{
			Secret: []byte(secret), Environment: env, Accounts: fakeOpsAccounts{"evilsysadmin": true},
			Now: func() time.Time { return now },
			Import: func(_ context.Context, username string) (any, error) {
				imported = append(imported, username)
				return map[string]int{"runsImported": 2}, nil
			},
		})
	}
	call := func(h http.Handler, token, body string) int {
		req := httptest.NewRequest(http.MethodPost, OpsImportLegacyPattern, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	good := opsTokenFor(secret, "evilsysadmin", "ops_import_legacy", now.Add(5*time.Minute))
	cases := []struct {
		env, token, body string
		want             int
	}{
		{"production", good, `{"username":"evilsysadmin"}`, http.StatusNotFound},
		{"staging", "", `{"username":"evilsysadmin"}`, http.StatusUnauthorized},
		// A delete-account token must not import, and vice versa.
		{"staging", opsTokenFor(secret, "evilsysadmin", "ops_delete_account", now.Add(time.Minute)), `{"username":"evilsysadmin"}`, http.StatusUnauthorized},
		{"staging", good, `{"username":"someone"}`, http.StatusBadRequest},
		{"staging", opsTokenFor(secret, "ghost", "ops_import_legacy", now.Add(time.Minute)), `{"username":"ghost"}`, http.StatusNotFound},
		{"staging", good, `{"username":"evilsysadmin"}`, http.StatusOK},
	}
	for i, c := range cases {
		if code := call(handler(c.env), c.token, c.body); code != c.want {
			t.Fatalf("case %d: got %d want %d", i, code, c.want)
		}
	}
	if len(imported) != 1 || imported[0] != "evilsysadmin" {
		t.Fatalf("imported %v", imported)
	}
}
