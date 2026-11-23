package pyval

import (
	"strings"
	"testing"
	"time"
)

// The observation-history reader compiles against ParseISOFormat, even though
// that reader's query routes are outside the currently analyzed main call graph.
func TestParseISOFormatRetainsObservationHistoryTimestamps(t *testing.T) {
	cases := []struct {
		raw   string
		want  time.Time
		aware bool
	}{
		{"2026-11-23", time.Date(2026, 11, 23, 0, 0, 0, 0, time.UTC), false},
		{"2026-11-23T10:30:00+01:00", time.Date(2026, 11, 23, 9, 30, 0, 0, time.UTC), true},
		{"2026-11-23T09:30:00Z", time.Date(2026, 11, 23, 9, 30, 0, 0, time.UTC), true},
		{"2026-11-23T09:30:00.123456Z", time.Date(2026, 11, 23, 9, 30, 0, 123456000, time.UTC), true},
	}
	for _, tc := range cases {
		got, aware, err := ParseISOFormat(tc.raw)
		if err != nil || aware != tc.aware || !got.Equal(tc.want) {
			t.Fatalf("ParseISOFormat(%q) = %s, aware=%t, err=%v; want %s, aware=%t",
				tc.raw, got.Format(time.RFC3339Nano), aware, err, tc.want.Format(time.RFC3339Nano), tc.aware)
		}
	}
}

func TestParseISOFormatRejectsInvalidObservationHistoryDates(t *testing.T) {
	for _, raw := range []string{
		"invalid",
		"2026-02-30",
		"2026-11-23T25:00:00",
		"2026-11-23T09:30:00+24:00",
	} {
		_, _, err := ParseISOFormat(raw)
		if err == nil || strings.TrimSpace(err.Error()) == "" {
			t.Fatalf("ParseISOFormat(%q) should return a nonempty error; got %v", raw, err)
		}
	}
}
