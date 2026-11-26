package chronicles

import (
	"errors"
	"math"
	"reflect"
	"testing"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pydoc"
)

func TestBSONIntegerDecodingFastPathBoundaries(t *testing.T) {
	for _, tc := range []struct {
		input string
		want  any
	}{
		{"0", int32(0)}, {"-0", int32(0)},
		{"2147483647", int32(math.MaxInt32)},
		{"-2147483648", int32(math.MinInt32)},
		{"2147483648", int64(2147483648)},
		{"-2147483649", int64(-2147483649)},
		{"9223372036854775807", int64(math.MaxInt64)},
		{"-9223372036854775808", int64(math.MinInt64)},
		{"1.0", float64(1)}, {"1e3", float64(1000)},
	} {
		got, err := pydoc.Decode([]byte(tc.input))
		if err != nil || !reflect.DeepEqual(got, tc.want) {
			t.Fatalf("Decode(%s) = %v (%T), %v; want %v (%T)", tc.input, got, got, err, tc.want, tc.want)
		}
	}
	for _, raw := range []string{"9223372036854775808", "-9223372036854775809", "99999999999999999999999999999999999999"} {
		if _, err := pydoc.Decode([]byte(raw)); !errors.Is(err, pydoc.ErrIntegerTooLarge) {
			t.Fatalf("Decode(%s): expected BSON overflow, got %v", raw, err)
		}
	}
}

func TestBSONNumericEqualityFastPathPreservesPythonSemantics(t *testing.T) {
	for _, tc := range []struct {
		a, b any
		want bool
	}{
		{true, true, true}, {true, false, false},
		{int(1), int(2), false},
		{int32(-1), int32(-1), true}, {int32(1), int32(2), false},
		{int64(math.MaxInt64), int64(math.MaxInt64-1), false},
		{int64(math.MinInt64), int64(math.MinInt64), true},
		{1.5, 1.5, true}, {1.5, 1.6, false},
		{math.Copysign(0, -1), float64(0), true},
		{math.NaN(), math.NaN(), false},
		{math.Inf(1), math.Inf(1), true}, {math.Inf(1), math.Inf(-1), false},
		{true, int32(1), true}, {int32(1), int64(1), true},
		{int64(9007199254740993), float64(9007199254740992), false},
		{int64(9007199254740992), float64(9007199254740992), true},
		{int64(math.MaxInt64), float64(math.MaxInt64), false},
		{int64(1), "1", false}, {math.NaN(), int64(0), false},
	} {
		if got := pydoc.Equal(tc.a, tc.b); got != tc.want {
			t.Fatalf("Equal(%v %T, %v %T) = %t; want %t", tc.a, tc.a, tc.b, tc.b, got, tc.want)
		}
		if got := pydoc.Equal(tc.b, tc.a); got != tc.want {
			t.Fatalf("reverse equality differs for %v and %v", tc.a, tc.b)
		}
	}
}
