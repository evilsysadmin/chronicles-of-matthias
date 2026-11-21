package gamesapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQueryIntSharedAcrossChroniclesRoutes(t *testing.T) {
	for _, tc := range []struct {
		raw, want string
	}{
		{"0", "0"},
		{"  +001_024.000 ", "1024"},
		{"-3", "-3"},
		{"18446744073709551616", "18446744073709551616"},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			n := queryInt(tc.raw)
			if n == nil || n.String() != tc.want {
				t.Fatalf("queryInt(%q) = %v; want %s", tc.raw, n, tc.want)
			}
		})
	}
	for _, raw := range []string{"", "_1", "1_", "1__2", "1.25", "1e3", "NaN"} {
		t.Run("invalid/"+raw, func(t *testing.T) {
			if n := queryInt(raw); n != nil {
				t.Fatalf("queryInt(%q) = %v; want nil", raw, n)
			}
		})
	}
}

func TestChroniclesSeedQueryContract(t *testing.T) {
	for _, tc := range []struct {
		query string
		want int64
		problem string
	}{
		{"", 0, ""},
		{"?seed=0", 0, ""},
		{"?seed=1_0.000", 10, ""},
		{"?seed=12", 12, ""},
		{"?seed=-1", 0, "greater_than_equal"},
		{"?seed=13", 0, "less_than_equal"},
		{"?seed=1.5", 0, "int_parsing"},
	} {
		t.Run(tc.query, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/api/chronicles/maps/area"+tc.query, nil)
			got, problem := seedQuery(r, 12)
			if got != tc.want {
				t.Fatalf("seed = %d; want %d", got, tc.want)
			}
			if tc.problem == "" {
				if problem != nil {
					t.Fatalf("unexpected validation error: %v", problem)
				}
				return
			}
			if len(problem) == 0 || problem[0].Key != "type" || problem[0].Value != tc.problem {
				t.Fatalf("validation error = %v; want %s", problem, tc.problem)
			}
		})
	}
}
