// Package gameops preserves Python-compatible idempotency keys and
// fingerprints for active Chronicles run creation and checkpoint requests.
// Legacy Chess Studio move parsing, CPU-game IDs and ledgers are retired.
package gameops

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pyjson"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/pyval"
)

var (
	ErrInvalidKey = errors.New("invalid idempotency key")
	ErrInvalidBody = errors.New("invalid request body")
)

const InvalidKeyDetail = "Idempotency-Key inválida."

var keyPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,96}$`)

// NormalizeKey mirrors normalize_idempotency_key: nil when absent.
func NormalizeKey(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	key := pyval.Strip(*raw)
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

// laxFloat mirrors pydantic v2 lax float coercion for JSON input: numbers,
// numeric strings and booleans.
func laxFloat(raw json.RawMessage) (float64, error) {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return 0, ErrInvalidBody
	}
	switch x := v.(type) {
	case float64:
		return x, nil
	case bool:
		if x {
			return 1, nil
		}
		return 0, nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(x), 64)
		if err != nil {
			return 0, ErrInvalidBody
		}
		return f, nil
	default:
		return 0, fmt.Errorf("%w: difficulty", ErrInvalidBody)
	}
}

// LaxFloat is pydantic v2's lax float coercion for one JSON value.
func LaxFloat(raw json.RawMessage) (float64, error) { return laxFloat(raw) }
