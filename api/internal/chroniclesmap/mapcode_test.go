package chroniclesmap

import (
	"strings"
	"testing"
)

func TestLiveRecipeEncodingAndGenerationRemainDeterministic(t *testing.T) {
	recipe := Recipe{
		Theme: "CRYPT", Width: 15, Height: 11,
		Verbs: []string{"HUNT", "lever"},
		Enemies: 3, Treasures: 1, Secrets: 1, Difficulty: 2, Seed: 17,
	}
	const expectedCode = "CM1|theme=crypt|size=15x11|verbs=hunt,lever|enemies=3|treasures=1|secrets=1|difficulty=2|seed=17"
	code, err := Encode(recipe)
	if err != nil || code != expectedCode {
		t.Fatalf("Encode = %q, %v; want %q", code, err, expectedCode)
	}
	one, err := GenerateRecipe(recipe)
	if err != nil {
		t.Fatalf("GenerateRecipe first pass: %v", err)
	}
	two, err := GenerateRecipe(recipe)
	if err != nil {
		t.Fatalf("GenerateRecipe second pass: %v", err)
	}
	if one.MapCode != expectedCode || two.MapCode != expectedCode ||
		one.LayoutRevision == "" || one.LayoutRevision != two.LayoutRevision ||
		strings.Join(one.Grid, "\n") != strings.Join(two.Grid, "\n") {
		t.Fatalf("same recipe changed generated layout or revision")
	}
	if len(one.Grid) != recipe.Height || len(one.Grid[0]) != recipe.Width ||
		one.PartyStart.X != 1 || one.PartyStart.Y != 1 || one.WalkableCount < 2 {
		t.Fatalf("invalid generated map shape or party start: %+v", one)
	}
}

func TestGeneratorAndEncoderAgreeOnRecipeValidation(t *testing.T) {
	valid := Recipe{
		Theme: " CRYPT ", Width: 15, Height: 11,
		Verbs: []string{" HUNT ", "lever"},
		Enemies: 3, Treasures: 1, Secrets: 1, Difficulty: 2, Seed: 17,
	}
	invalidTheme, invalidVerbs, invalidSeed := valid, valid, valid
	invalidTheme.Theme = "unknown"
	invalidVerbs.Verbs = []string{"hunt", "HUNT"}
	invalidSeed.Seed = -1
	for _, recipe := range []Recipe{valid, invalidTheme, invalidVerbs, invalidSeed} {
		code, encodeErr := Encode(recipe)
		layout, generateErr := GenerateRecipe(recipe)
		if encodeErr != nil {
			if generateErr == nil || generateErr.Error() != encodeErr.Error() {
				t.Fatalf("validation differs: encoder %v; generator %v", encodeErr, generateErr)
			}
			continue
		}
		if generateErr != nil || layout.MapCode != code {
			t.Fatalf("generated code %q, %v; want %q", layout.MapCode, generateErr, code)
		}
	}
}

func TestVerbNormalizationPreservesLegacyCommaAndErrorSemantics(t *testing.T) {
	base := Recipe{Theme: "crypt", Width: 15, Height: 11, Enemies: 3, Difficulty: 2, Seed: 17}
	for _, tc := range []struct {
		input []string
		want  string
		err   string
	}{
		{input: nil, err: "verbs must contain at least one entry"},
		{input: []string{"", " , "}, err: "verbs must contain at least one entry"},
		{input: []string{" HUNT, ", ",lever", " KEYs "}, want: "hunt,lever,keys"},
		{input: []string{"unknown", "hunt", "HUNT"}, err: "verbs must be unique"},
		{input: []string{"unknown", "hunt", "lever", "keys", "patrol"}, err: "verbs supports at most 4 entries"},
		{input: []string{"hunt", "unknown"}, err: "unsupported verb: unknown"},
		{input: []string{"hunt", "lever", "keys", "patrol"}, want: "hunt,lever,keys,patrol"},
	} {
		recipe := base
		recipe.Verbs = tc.input
		got, err := Validate(recipe)
		if tc.err != "" {
			if err == nil || err.Error() != tc.err {
				t.Fatalf("verbs %q: got %v; want %q", tc.input, err, tc.err)
			}
			continue
		}
		if err != nil || strings.Join(got.Verbs, ",") != tc.want {
			t.Fatalf("verbs %q: got %v, %v; want %s", tc.input, got.Verbs, err, tc.want)
		}
	}
}
