package gamesapi

// Shared request query parsers used by Chronicles maps and run validation.
// Retained verbatim when removing the unmounted Pawn Slug handler.

import (
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// queryInt mirrors pydantic's lax str -> int for a query parameter: the
// surrounding whitespace, a sign, ASCII digits with single underscores and
// an all-zero fraction are accepted; nil when it is not an integer.
func queryInt(raw string) *big.Int {
	s := strings.TrimSpace(raw)
	sign := ""
	if s != "" && (s[0] == '+' || s[0] == '-') {
		if s[0] == '-' {
			sign = "-"
		}
		s = s[1:]
	}
	if whole, frac, hasDot := strings.Cut(s, "."); hasDot {
		if frac == "" || strings.Trim(frac, "0") != "" {
			return nil
		}
		s = whole
	}
	if s == "" || s[0] == '_' || s[len(s)-1] == '_' || strings.Contains(s, "__") {
		return nil
	}
	digits := strings.ReplaceAll(s, "_", "")
	for i := 0; i < len(digits); i++ {
		if digits[i] < '0' || digits[i] > '9' {
			return nil
		}
	}
	n, ok := new(big.Int).SetString(sign+digits, 10)
	if !ok {
		return nil
	}
	return n
}

// seedQuery is `seed: int = Query(default=0, ge=0, le=maxSeed)`: the
// value, or the pydantic error FastAPI answers as a 422.
func seedQuery(r *http.Request, maxSeed int64) (int64, bson.D) {
	values, present := r.URL.Query()["seed"]
	if !present || len(values) == 0 {
		return 0, nil
	}
	raw := values[len(values)-1]
	n := queryInt(raw)
	loc := bson.A{"query", "seed"}
	switch {
	case n == nil:
		return 0, bson.D{{Key: "type", Value: "int_parsing"}, {Key: "loc", Value: loc}, {Key: "msg", Value: "Input should be a valid integer, unable to parse string as an integer"}, {Key: "input", Value: raw}}
	case n.Sign() < 0:
		return 0, bson.D{{Key: "type", Value: "greater_than_equal"}, {Key: "loc", Value: loc}, {Key: "msg", Value: "Input should be greater than or equal to 0"}, {Key: "input", Value: raw}, {Key: "ctx", Value: bson.D{{Key: "ge", Value: int64(0)}}}}
	case n.Cmp(big.NewInt(maxSeed)) > 0:
		return 0, bson.D{{Key: "type", Value: "less_than_equal"}, {Key: "loc", Value: loc}, {Key: "msg", Value: fmt.Sprintf("Input should be less than or equal to %d", maxSeed)}, {Key: "input", Value: raw}, {Key: "ctx", Value: bson.D{{Key: "le", Value: maxSeed}}}}
	}
	return n.Int64(), nil
}
