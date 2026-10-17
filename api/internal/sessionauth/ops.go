package sessionauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"time"
)

// OpsMaxLifetime bounds an operator token: minted by a CI job right before
// the one call it authorises, never stored.
const OpsMaxLifetime = 15 * time.Minute

// VerifyOps checks an operator token: HS256 with the server secret, the
// expected purpose, unexpired and short-lived. Only holders of the API's
// JWT secret (the deploy pipeline) can mint one, and they could already
// forge any session, so this adds no new authority.
func VerifyOps(token, purpose string, secret []byte, now time.Time) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || purpose == "" || len(secret) == 0 {
		return "", false
	}
	var header map[string]any
	if decodePart(parts[0], &header) != nil || header["alg"] != "HS256" {
		return "", false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", false
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return "", false
	}
	var payload map[string]any
	if decodePart(parts[1], &payload) != nil || payload["purpose"] != purpose {
		return "", false
	}
	exp, ok := payload["exp"].(float64)
	if !ok || checkTimes(payload, now) != nil || exp > float64(now.Add(OpsMaxLifetime).Unix()) {
		return "", false
	}
	sub, ok := payload["sub"].(string)
	sub = strings.ToLower(strings.TrimSpace(sub))
	return sub, ok && sub != ""
}
