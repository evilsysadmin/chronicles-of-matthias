// Package gameops preserves Python-compatible idempotency keys and
// fingerprints for active Chronicles run creation and checkpoint requests.
// Legacy Chess Studio move parsing, CPU-game IDs and ledgers are retired.
package gameops

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"unicode"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pyjson"
)

var ErrInvalidKey = errors.New("invalid idempotency key")

const InvalidKeyDetail = "Idempotency-Key inválida."

var keyPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,96}$`)

// pyStrip is Python str.strip(): Unicode whitespace plus \x1c-\x1f, which
// Python treats as whitespace and Go's unicode.IsSpace does not.
func pyStrip(s string) string {
	return strings.TrimFunc(s, func(r rune) bool {
		return unicode.IsSpace(r) || (r >= 0x1c && r <= 0x1f)
	})
}

// NormalizeKey mirrors normalize_idempotency_key: nil when absent.
func NormalizeKey(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	key := pyStrip(*raw)
	if !keyPattern.MatchString(key) {
		return nil, ErrInvalidKey
	}
	return &key, nil
}

// Fingerprint mirrors operation_fingerprint.
func Fingerprint(payload map[string]any) (string, error) {
	canonical, err := pyjson.Dumps(payload)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:]), nil
}
