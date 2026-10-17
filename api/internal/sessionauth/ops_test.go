package sessionauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"testing"
	"time"
)

func mintOps(t *testing.T, secret, sub, purpose string, exp time.Time) string {
	t.Helper()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + sub + `","purpose":"` + purpose + `","exp":` + strconv.FormatInt(exp.Unix(), 10) + `}`))
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(header + "." + payload))
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestVerifyOps(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "0123456789abcdef0123456789abcdef"
	good := mintOps(t, secret, "EvilSysAdmin", "ops_delete_account", now.Add(5*time.Minute))
	if sub, ok := VerifyOps(good, "ops_delete_account", []byte(secret), now); !ok || sub != "evilsysadmin" {
		t.Fatalf("valid token rejected: %q %v", sub, ok)
	}
	cases := map[string]string{
		"wrong secret":  mintOps(t, "another-secret-another-secret-xx", "u", "ops_delete_account", now.Add(time.Minute)),
		"wrong purpose": mintOps(t, secret, "u", "session", now.Add(time.Minute)),
		"expired":       mintOps(t, secret, "u", "ops_delete_account", now.Add(-time.Second)),
		"too long":      mintOps(t, secret, "u", "ops_delete_account", now.Add(2*time.Hour)),
		"no subject":    mintOps(t, secret, " ", "ops_delete_account", now.Add(time.Minute)),
		"garbage":       "a.b.c",
	}
	for name, token := range cases {
		if _, ok := VerifyOps(token, "ops_delete_account", []byte(secret), now); ok {
			t.Errorf("%s: accepted", name)
		}
	}
}
