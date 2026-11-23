package gameops

import (
	"errors"
	"testing"
)

func TestNormalizeKeyKeepsPythonWhitespaceAndStrictShape(t *testing.T) {
	if got, err := NormalizeKey(nil); got != nil || err != nil {
		t.Fatalf("missing key = %v, %v; want nil, nil", got, err)
	}
	for _, tc := range []struct {
		input string
		want  string
	}{
		{input: "  Chronicles.run-08\t", want: "Chronicles.run-08"},
		{input: "\u001fChronicles.run-08\u001c", want: "Chronicles.run-08"},
		{input: "key_1234", want: "key_1234"},
	} {
		got, err := NormalizeKey(&tc.input)
		if err != nil || got == nil || *got != tc.want {
			t.Fatalf("NormalizeKey(%q) = %v, %v; want %q", tc.input, got, err, tc.want)
		}
	}
	for _, input := range []string{"", "abc", "bad key", "a/b", "invalid🚀"} {
		if got, err := NormalizeKey(&input); got != nil || !errors.Is(err, ErrInvalidKey) {
			t.Fatalf("invalid key %q accepted: %v, %v", input, got, err)
		}
	}
}

func TestFingerprintMatchesPythonCanonicalJSON(t *testing.T) {
	const want = "194bce383c2879fb421d99ee00f31c7c0c22916babefc4549c9704278602a39e"
	one, err := Fingerprint(map[string]any{"mapId": "terra", "kind": "create"})
	if err != nil || one != want {
		t.Fatalf("canonical fingerprint = %q, %v; want %q", one, err, want)
	}
	two, err := Fingerprint(map[string]any{"kind": "create", "mapId": "terra"})
	if err != nil || two != want {
		t.Fatalf("different insertion order changed fingerprint: %q, %v", two, err)
	}
}

func TestLaxFloatPreservesSystemNumericCoercion(t *testing.T) {
	for _, tc := range []struct {
		raw string
		want float64
	}{
		{raw: `2.5`, want: 2.5},
		{raw: `"1.25"`, want: 1.25},
		{raw: `true`, want: 1},
		{raw: `false`, want: 0},
	} {
		value, err := LaxFloat([]byte(tc.raw))
		if err != nil || value != tc.want {
			t.Fatalf("LaxFloat(%q) = %v, %v; want %v", tc.raw, value, err, tc.want)
		}
	}
	for _, raw := range []string{`null`, `{}`, `"not-a-number"`} {
		if _, err := LaxFloat([]byte(raw)); !errors.Is(err, ErrInvalidBody) {
			t.Fatalf("LaxFloat(%q) error = %v; want ErrInvalidBody", raw, err)
		}
	}
}
