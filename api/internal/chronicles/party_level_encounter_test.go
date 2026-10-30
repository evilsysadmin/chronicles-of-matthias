package chronicles

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Keep the same shipped encounter bounded by the party's actual level on a
// deeper floor. Repeating the first request detects cross-run state leaks.
func TestShippedCryptEncounterScalesWithPartyLevelWithoutLeaking(t *testing.T) {
	const mapID = "crypt-eight-squares"
	const seed int64 = 12345
	route, err := NormalizeRouteSnapshot((&RouteSnapshot{
		PolicyVersion: 4,
		MapIDs:        []string{"gallery-of-forks", "menagerie-of-ash", mapID, "echo-cistern"},
		PrimaryExitIDs: map[string]string{
			"gallery-of-forks": "gallery-gate",
			"menagerie-of-ash": "menagerie-gate",
			mapID:              "black-gate",
		},
	}).Doc())
	if err != nil {
		t.Fatalf("normalize route: %v", err)
	}

	type enemyStats struct{ hp, retaliation, level int64 }
	type encounter struct {
		enemies map[string]enemyStats
		revision string
		totalHP int64
	}
	measure := func(partyLevel int64) encounter {
		t.Helper()
		area, err := AreaEnvelope(mapID, seed, AreaOptions{Route: route, PartyLevel: &partyLevel})
		if err != nil {
			t.Fatalf("party level %d: area envelope: %v", partyLevel, err)
		}
		band, ok := get(area, "difficulty").(bson.D)
		if !ok {
			t.Fatalf("party level %d: missing difficulty band", partyLevel)
		}
		if got := get(band, "depth"); got != int64(2) {
			t.Fatalf("party level %d: depth = %v, want 2", partyLevel, got)
		}
		if got := get(band, "partyLevel"); got != partyLevel {
			t.Fatalf("party level %d: band partyLevel = %v", partyLevel, got)
		}
		minLevel, okMin := get(band, "minLevel").(int64)
		maxLevel, okMax := get(band, "maxLevel").(int64)
		if !okMin || !okMax || minLevel < 1 || maxLevel > partyLevel+1 {
			t.Fatalf("party level %d: invalid enemy level band [%v, %v]", partyLevel, get(band, "minLevel"), get(band, "maxLevel"))
		}
		manifest := get(area, "manifest").(bson.D)
		enemies := docs(get(manifest, "enemies"))
		if len(enemies) == 0 {
			t.Fatal("shipped crypt lost its enemies")
		}
		result := encounter{enemies: make(map[string]enemyStats, len(enemies))}
		result.revision, _ = get(area, "manifestRevision").(string)
		if result.revision == "" {
			t.Fatal("missing manifest revision")
		}
		for _, enemy := range enemies {
			id, _ := get(enemy, "id").(string)
			if id == "" {
				t.Fatalf("enemy without ID: %v", enemy)
			}
			if _, exists := result.enemies[id]; exists {
				t.Fatalf("duplicate enemy ID %q", id)
			}
			hp, hpOK := get(enemy, "maxHp").(int64)
			retaliation, retaliationOK := get(enemy, "retaliation").(int64)
			level, levelOK := get(enemy, "difficultyLevel").(int64)
			if !hpOK || !retaliationOK || !levelOK || hp < 1 || retaliation < 0 || level < minLevel || level > maxLevel {
				t.Fatalf("party level %d: %s has invalid stats hp=%v retaliation=%v level=%v band=[%d,%d]", partyLevel, id, get(enemy, "maxHp"), get(enemy, "retaliation"), get(enemy, "difficultyLevel"), minLevel, maxLevel)
			}
			result.enemies[id] = enemyStats{hp, retaliation, level}
			result.totalHP += hp
		}
		return result
	}

	low := measure(1)
	mid := measure(6)
	high := measure(12)
	for _, pair := range []struct {
		name string
		shallow, stronger encounter
	}{
		{"level 1 to 6", low, mid},
		{"level 6 to 12", mid, high},
	} {
		if len(pair.shallow.enemies) != len(pair.stronger.enemies) {
			t.Errorf("%s: enemy composition changed", pair.name)
		}
		for id, first := range pair.shallow.enemies {
			later, ok := pair.stronger.enemies[id]
			if !ok {
				t.Errorf("%s: missing enemy %s", pair.name, id)
				continue
			}
			if later.hp < first.hp || later.retaliation < first.retaliation || later.level < first.level {
				t.Errorf("%s: enemy %s weakened: %+v -> %+v", pair.name, id, first, later)
			}
		}
		if pair.stronger.totalHP <= pair.shallow.totalHP {
			t.Errorf("%s: encounter HP did not increase: %d -> %d", pair.name, pair.shallow.totalHP, pair.stronger.totalHP)
		}
	}
	if again := measure(1); !reflect.DeepEqual(again, low) {
		t.Errorf("low-level encounter changed after other party levels: before=%+v after=%+v", low, again)
	}
}
