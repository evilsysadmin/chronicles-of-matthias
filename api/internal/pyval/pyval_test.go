package pyval

import (
	"errors"
	"testing"
)

func TestLivePythonCompatibleIntegerConversion(t *testing.T) {
	for _, tc := range []struct {
		input any
		want  int64
	}{
		{true, 1},
		{false, 0},
		{int64(-7), -7},
		{float64(12.9), 12},
		{"1_024", 1024},
		{"  +23  ", 23},
	} {
		got, err := Int(tc.input)
		if err != nil || got != tc.want {
			t.Fatalf("Int(%#v) = %d, %v; want %d", tc.input, got, err, tc.want)
		}
	}
	for _, input := range []any{"nope", "12__3", "1e3"} {
		if _, err := Int(input); !errors.Is(err, ErrValue) {
			t.Fatalf("Int(%#v) error = %v; want ErrValue", input, err)
		}
	}
}

func TestLivePythonCompatibleStrip(t *testing.T) {
	if got := Strip("\u001c  Chronicles run  \u001f"); got != "Chronicles run" {
		t.Fatalf("Strip missed Python-only whitespace: %q", got)
	}
	if got := Strip("  run-07\t"); got != "run-07" {
		t.Fatalf("Strip missed standard whitespace: %q", got)
	}
}
