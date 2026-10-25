package chronicles

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Optional encounters may vary with the seed, but a quest-linked enemy or
// an enemy that unlocks the next floor must never disappear with that roll.
func TestSeededCompositionKeepsQuestAndExitGuards(t *testing.T) {
	manifest := bson.D{
		{Key: "id", Value: "crypt-eight-squares"},
		{Key: "enemies", Value: bson.A{
			bson.D{{Key: "id", Value: "boss"}},
			bson.D{{Key: "id", Value: "scout"}, {Key: "optional", Value: true}, {Key: "hpKey", Value: "scoutHp"}},
			bson.D{{Key: "id", Value: "quest-guard"}, {Key: "optional", Value: true}, {Key: "hpKey", Value: "questGuardHp"}},
			bson.D{
				{Key: "id", Value: "exit-guard"}, {Key: "optional", Value: true}, {Key: "hpKey", Value: "exitGuardHp"},
				{Key: "onDefeat", Value: bson.D{{Key: "effects", Value: bson.A{
					bson.D{{Key: "type", Value: "transition-map"}, {Key: "mapId", Value: "next-floor"}},
				}}}},
			},
		}},
		{Key: "triggers", Value: bson.A{bson.D{{Key: "flag", Value: "questGuardHp"}}}},
	}
	included, omitted := 0, 0
	for seed := int64(0); seed < 64; seed++ {
		composed, _ := applyComposition(manifest, seed)
		again, _ := applyComposition(manifest, seed)
		if !reflect.DeepEqual(composed, again) {
			t.Fatalf("seed %d: encounter composition changed on replay", seed)
		}
		ids := map[string]bool{}
		for _, enemy := range docs(get(composed, "enemies")) {
			ids[get(enemy, "id").(string)] = true
		}
		for _, required := range []string{"boss", "quest-guard", "exit-guard"} {
			if !ids[required] {
				t.Fatalf("seed %d: required encounter %q was omitted", seed, required)
			}
		}
		if ids["scout"] {
			included++
		} else {
			omitted++
		}
	}
	if included == 0 || omitted == 0 {
		t.Fatalf("optional encounter did not vary across seeds: included=%d omitted=%d", included, omitted)
	}
	if got := len(docs(get(manifest, "enemies"))); got != 4 {
		t.Fatalf("authored encounters mutated: got %d, want 4", got)
	}
}
