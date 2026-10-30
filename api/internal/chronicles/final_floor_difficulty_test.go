package chronicles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// The final stop in a maximum-length authored route must use its real depth,
// not the first floor's default pressure. This exercises shipped maps and
// the API envelope, without changing encounter balance or the route itself.
func TestFinalCisternUsesFourthFloorDifficulty(t *testing.T) {
	const seed int64 = 12345
	partyLevel := int64(6)
	route, err := NormalizeRouteSnapshot((&RouteSnapshot{
		PolicyVersion: 4,
		MapIDs:        []string{"gallery-of-forks", "menagerie-of-ash", "crypt-eight-squares", "echo-cistern"},
		PrimaryExitIDs: map[string]string{
			"gallery-of-forks":    "gallery-gate",
			"menagerie-of-ash":    "menagerie-gate",
			"crypt-eight-squares": "black-gate",
		},
	}).Doc())
	if err != nil {
		t.Fatalf("normalize shipped route: %v", err)
	}

	first, err := AreaEnvelope("gallery-of-forks", seed, AreaOptions{Route: route, PartyLevel: &partyLevel})
	if err != nil {
		t.Fatalf("first floor envelope: %v", err)
	}
	final, err := AreaEnvelope("echo-cistern", seed, AreaOptions{Route: route, PartyLevel: &partyLevel})
	if err != nil {
		t.Fatalf("final floor envelope: %v", err)
	}
	firstBand, ok := get(first, "difficulty").(bson.D)
	if !ok {
		t.Fatal("first floor missing difficulty band")
	}
	finalBand, ok := get(final, "difficulty").(bson.D)
	if !ok {
		t.Fatal("final floor missing difficulty band")
	}
	for _, tc := range []struct {
		name          string
		band          bson.D
		depth, target int64
	}{
		{"first floor", firstBand, 0, 3},
		{"final floor", finalBand, 3, 4},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := get(tc.band, "depth"); got != tc.depth {
				t.Errorf("depth = %v, want %d", got, tc.depth)
			}
			if got := get(tc.band, "targetLevel"); got != tc.target {
				t.Errorf("target level = %v, want %d", got, tc.target)
			}
		})
	}

	manifest, ok := get(final, "manifest").(bson.D)
	if !ok {
		t.Fatal("final floor missing scaled manifest")
	}
	generation, ok := get(manifest, "generation").(bson.D)
	if !ok {
		t.Fatal("final floor missing generation metadata")
	}
	routeMeta, ok := get(generation, "route").(bson.D)
	if !ok {
		t.Fatal("final floor missing route metadata")
	}
	if got := get(routeMeta, "index"); got != int64(3) {
		t.Errorf("final route index = %v, want 3", got)
	}
	if next := get(routeMeta, "nextMapId"); next != nil {
		t.Errorf("final floor must not invent another route stop: %v", next)
	}
	found := false
	for _, enemy := range docs(get(manifest, "enemies")) {
		if get(enemy, "id") != "cistern-warden" {
			continue
		}
		found = true
		// Authored HP 12, authored band 3, target 4: exactly +1 HP.
		if got := get(enemy, "maxHp"); got != int64(13) {
			t.Errorf("final warden HP = %v, want 13", got)
		}
		if got := get(enemy, "difficultyLevel"); got != int64(4) {
			t.Errorf("final warden difficulty level = %v, want 4", got)
		}
	}
	if !found {
		t.Fatal("final floor lost its authored cistern warden")
	}
}
