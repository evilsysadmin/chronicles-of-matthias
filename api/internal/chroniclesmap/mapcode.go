package chroniclesmap

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pyval"
)


// MapCode recipe validation and encoding feed the active procedural
// dungeon generator. The old public preview parser was retired.
const (
	MapCodeVersion   = 1
	MapCodePrefix    = "CM1"
	MapCodeMaxLength = 256
	MapCodeMaxSeed   = 2147483647
)

type Recipe struct {
	Theme      string
	Width      int
	Height     int
	Verbs      []string
	Enemies    int
	Treasures  int
	Secrets    int
	Difficulty int
	Seed       int
}

// Equal is the frozen dataclass's ==.
func (r Recipe) Equal(o Recipe) bool {
	if r.Theme != o.Theme || r.Width != o.Width || r.Height != o.Height || r.Enemies != o.Enemies ||
		r.Treasures != o.Treasures || r.Secrets != o.Secrets || r.Difficulty != o.Difficulty ||
		r.Seed != o.Seed || len(r.Verbs) != len(o.Verbs) {
		return false
	}
	for i := range r.Verbs {
		if r.Verbs[i] != o.Verbs[i] {
			return false
		}
	}
	return true
}

var allowedThemes = map[string]bool{
	"crypt": true, "gallery": true, "ash": true, "archive": true, "iron": true,
	"basilica": true, "bell": true, "glass": true, "water": true,
}

var allowedVerbs = map[string]bool{
	"hunt": true, "patrol": true, "lever": true, "sluice": true, "keys": true,
	"traps": true, "treasure": true, "secret": true, "guardian": true, "puzzle": true,
}

var fieldOrder = []string{
	"theme", "size", "verbs", "enemies", "treasures", "secrets", "difficulty", "seed",
}

// Error is ChroniclesMapCodeError.
type Error struct{ msg string }

func (e *Error) Error() string { return e.msg }

func codeErr(format string, args ...any) error { return &Error{msg: fmt.Sprintf(format, args...)} }

func normalizeTheme(raw string) (string, error) {
	theme := strings.ToLower(pyval.Strip(raw))
	if !allowedThemes[theme] {
		if theme == "" {
			theme = "<empty>"
		}
		return "", codeErr("unsupported theme: %s", theme)
	}
	return theme, nil
}

func normalizeVerbs(raw string) ([]string, error) {
	return normalizeVerbParts([]string{raw})
}

// Normalize comma-delimited parts directly, without joining the input slice
// only to split it again. Embedded commas retain the legacy interpretation.
func normalizeVerbParts(raw []string) ([]string, error) {
	values := make([]string, 0, 4)
	for _, entry := range raw {
		for part := range strings.SplitSeq(entry, ",") {
			if v := pyval.Strip(part); v != "" {
				values = append(values, strings.ToLower(v))
				if len(values) > 4 {
					return nil, codeErr("verbs supports at most 4 entries")
				}
			}
		}
	}
	if len(values) == 0 {
		return nil, codeErr("verbs must contain at least one entry")
	}
	// The list is capped at four entries, so a small pairwise comparison
	// avoids allocating a hash map while retaining duplicate-error precedence.
	for i, v := range values {
		for _, previous := range values[:i] {
			if v == previous {
				return nil, codeErr("verbs must be unique")
			}
		}
	}
	for _, v := range values {
		if !allowedVerbs[v] {
			return nil, codeErr("unsupported verb: %s", v)
		}
	}
	return values, nil
}

// Validate is validate_chronicles_map_code.
func Validate(recipe Recipe) (Recipe, error) {
	theme, err := normalizeTheme(recipe.Theme)
	if err != nil {
		return Recipe{}, err
	}
	verbs, err := normalizeVerbParts(recipe.Verbs)
	if err != nil {
		return Recipe{}, err
	}
	switch {
	case recipe.Width < 7 || recipe.Width > 19:
		return Recipe{}, codeErr("width must be between 7 and 19")
	case recipe.Height < 7 || recipe.Height > 15:
		return Recipe{}, codeErr("height must be between 7 and 15")
	case recipe.Enemies < 2 || recipe.Enemies > 8:
		return Recipe{}, codeErr("enemies must be between 2 and 8")
	case recipe.Treasures < 0 || recipe.Treasures > 4:
		return Recipe{}, codeErr("treasures must be between 0 and 4")
	case recipe.Secrets < 0 || recipe.Secrets > 3:
		return Recipe{}, codeErr("secrets must be between 0 and 3")
	case recipe.Difficulty < 1 || recipe.Difficulty > 5:
		return Recipe{}, codeErr("difficulty must be between 1 and 5")
	case recipe.Seed < 0 || recipe.Seed > MapCodeMaxSeed:
		return Recipe{}, codeErr("seed must be between 0 and %d", MapCodeMaxSeed)
	}
	recipe.Theme, recipe.Verbs = theme, verbs
	return recipe, nil
}

func Encode(recipe Recipe) (string, error) {
	recipe, err := Validate(recipe)
	if err != nil {
		return "", err
	}
	return encodeValidated(recipe), nil
}

// encodeValidated serializes a recipe already normalized by Validate.
func encodeValidated(recipe Recipe) string {
	fields := map[string]string{
		"theme":      recipe.Theme,
		"size":       fmt.Sprintf("%dx%d", recipe.Width, recipe.Height),
		"verbs":      strings.Join(recipe.Verbs, ","),
		"enemies":    strconv.Itoa(recipe.Enemies),
		"treasures":  strconv.Itoa(recipe.Treasures),
		"secrets":    strconv.Itoa(recipe.Secrets),
		"difficulty": strconv.Itoa(recipe.Difficulty),
		"seed":       strconv.Itoa(recipe.Seed),
	}
	parts := make([]string, 1, 1+len(fieldOrder))
	parts[0] = MapCodePrefix
	for _, key := range fieldOrder {
		parts = append(parts, key+"="+fields[key])
	}
	return strings.Join(parts, "|")
}
