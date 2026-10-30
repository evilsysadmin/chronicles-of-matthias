package chronicles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Compare the same shipped enemies at two valid route depths. This measures
// potential encounter HP and retaliation, not simulated win rate: changing
// the map or the party would make a depth comparison misleading.
func TestShippedCryptEncounterBudgetTracksRouteDepth(t *testing.T) {
	const mapID = "crypt-eight-squares"
	const seed int64 = 12345
	partyLevel := int64(6)
	routes := []struct {
		name  string
		ids   []string
		exits map[string]string
		depth int64
	}{
		{
			name:  "first floor",
			ids:   []string{mapID, "gallery-of-forks", "echo-cistern"},
			exits: map[string]string{mapID: "black-gate", "gallery-of-forks": "gallery-gate"},
			depth: 0,
		},
		{
			name:  "second floor",
			ids:   []string{"gallery-of-forks", mapID, "echo-cistern"},
			exits: map[string]string{"gallery-of-forks": "gallery-gate", mapID: "black-gate"},
			depth: 1,
		},
		{
			name:  "third floor",
			ids:   []string{"gallery-of-forks", "menagerie-of-ash", mapID, "echo-cistern"},
			exits: map[string]string{"gallery-of-forks": "gallery-gate", "menagerie-of-ash": "menagerie-gate", mapID: "black-gate"},
			depth: 2,
		},
	}
	type enemyBudget struct{ hp, retaliation, level int64 }
	budgets := make([]map[string]enemyBudget, 0, len(routes))
	for _, tc := range routes {
		t.Run(tc.name, func(t *testing.T) {
			route, err := NormalizeRouteSnapshot((&RouteSnapshot{
				PolicyVersion: 4, MapIDs: tc.ids, PrimaryExitIDs: tc.exits,
			}).Doc())
			if err != nil {
				t.Fatalf("normalize route: %v", err)
			}
			area, err := AreaEnvelope(mapID, seed, AreaOptions{Route: route, PartyLevel: &partyLevel})
			if err != nil {
				t.Fatalf("area envelope: %v", err)
			}
			band, ok := get(area, "difficulty").(bson.D)
			if !ok {
				t.Fatal("missing difficulty band")
			}
			if got := get(band, "depth"); got != tc.depth {
				t.Fatalf("depth = %v, want %d", got, tc.depth)
			}
			minLevel := get(band, "minLevel").(int64)
			maxLevel := get(band, "maxLevel").(int64)
			manifest := get(area, "manifest").(bson.D)
			enemies := docs(get(manifest, "enemies"))
			if len(enemies) == 0 {
				t.Fatal("shipped crypt has no enemies")
			}
			byID := make(map[string]enemyBudget, len(enemies))
			var hpBudget, retaliationBudget int64
			for _, enemy := range enemies {
				id, ok := get(enemy, "id").(string)
				if !ok || id == "" {
					t.Fatalf("enemy without ID: %v", enemy)
				}
				if _, exists := byID[id]; exists {
					t.Fatalf("duplicate enemy %s", id)
				}
				hp, ok := get(enemy, "maxHp").(int64)
				if !ok || hp < 1 {
					t.Fatalf("%s has invalid HP %v", id, get(enemy, "maxHp"))
				}
				retaliation, _ := get(enemy, "retaliation").(int64)
				if retaliation < 0 {
					t.Fatalf("%s has negative retaliation %d", id, retaliation)
				}
				level, ok := get(enemy, "difficultyLevel").(int64)
				if !ok || level < minLevel || level > maxLevel {
					t.Fatalf("%s level %v outside [%d, %d]", id, get(enemy, "difficultyLevel"), minLevel, maxLevel)
				}
				byID[id] = enemyBudget{hp, retaliation, level}
				hpBudget += hp
				retaliationBudget += retaliation
			}
			t.Logf("depth=%d enemies=%d totalHP=%d retaliationBudget=%d", tc.depth, len(byID), hpBudget, retaliationBudget)
			budgets = append(budgets, byID)
		})
	}
	if len(budgets) != 3 {
		t.Fatalf("measured %d floors, want 3", len(budgets))
	}
	// Checking only the first and third floors can hide a temporary
	// difficulty dip on the intermediate floor.
	for floor := 1; floor < len(budgets); floor++ {
		shallow, deep := budgets[floor-1], budgets[floor]
		if len(shallow) != len(deep) {
			t.Errorf("enemy count changed at depth %d: %d -> %d", floor, len(shallow), len(deep))
		}
		for id, first := range shallow {
			deeper, ok := deep[id]
			if !ok {
				t.Errorf("depth %d lost enemy %s", floor, id)
				continue
			}
			if deeper.hp < first.hp || deeper.retaliation < first.retaliation || deeper.level < first.level {
				t.Errorf("%s became weaker at depth %d: %+v -> %+v", id, floor, first, deeper)
			}
		}
	}
	strengthened := 0
	for id, first := range budgets[0] {
		if deep, ok := budgets[2][id]; ok && deep.hp > first.hp {
			strengthened++
		}
	}
	if strengthened == 0 {
		t.Error("third-floor encounter gained no HP despite higher target level")
	}
}
