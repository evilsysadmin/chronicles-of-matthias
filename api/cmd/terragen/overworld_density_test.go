package main

import (
	"fmt"
	"testing"
)

// A region-wide budget is better than adding mobs only to the first dungeon.
// Existing saves refer to the original enemy indexes: the added patrols must
// always be appended, and no authored quest/boss foe may be cloned.
func TestTerraWidePatrolDensityRespectsSafetyAndPersistence(t *testing.T) {
	built := buildAll()
	baseline := story().areas
	addedTotal := 0
	for _, code := range areaOrder {
		m := built[mapID(code)]
		original := buildArea(code, baseline).Arr("enemies")
		all := m.Arr("enemies")
		ordinary := 0
		for ordinary < len(original) && original[ordinary].(*O).Str("id") ==
			fmt.Sprintf("%s-foe-%d", mapID(code), ordinary) {
			ordinary++
		}
		firstWave := 3
		if ordinary >= 4 {
			firstWave = 4
		}
		added := all[len(original)+firstWave:]
		if len(added) < 1 || len(added) > extraOverworldPatrolLimit {
			t.Fatalf("%s: expected 1–%d additional safe patrols; got %d", code, extraOverworldPatrolLimit, len(added))
		}
		rows := parse(dump(m)).(*O).Arr("grid")
		grid := make([][]byte, len(rows))
		for y, raw := range rows {
			grid[y] = []byte(raw.(string))
		}
		start := m.Obj("partyStart")
		spawn := point{start.Int("x"), start.Int("y")}
		accessible := reachable(grid, spawn)
		distance := func(a, b point) int { return abs(a.x-b.x) + abs(a.y-b.y) }
		used := map[point]bool{}
		for _, raw := range all[:len(original)+firstWave] {
			e := raw.(*O)
			used[point{e.Int("x"), e.Int("y")}] = true
		}
		for i, raw := range added {
			e := raw.(*O)
			p := point{e.Int("x"), e.Int("y")}
			expectedID := fmt.Sprintf("%s-foe-%d", mapID(code), ordinary+firstWave+i)
			expectedHpKey := fmt.Sprintf("%sFoe%dHp", camelFlag(mapID(code)), ordinary+firstWave+i)
			if e.Str("id") != expectedID || e.Str("hpKey") != expectedHpKey {
				t.Fatalf("%s: new patrol identity changed: %s", code, dump(e))
			}
			if used[p] || !accessible[p] || distance(p, spawn) < patrolStartClearance {
				t.Fatalf("%s: new patrol %s overlaps, is unreachable or starts too near player at %v", code, expectedID, p)
			}
			for other := range used {
				if distance(p, other) < 2 {
					t.Fatalf("%s: patrol %s crowds another foe at %v", code, expectedID, p)
				}
			}
			for _, rawExit := range m.Arr("exits") {
				ex := rawExit.(*O)
				if distance(p, point{ex.Int("x"), ex.Int("y")}) < patrolGateClearance {
					t.Fatalf("%s: patrol %s threatens an arrival gate", code, expectedID)
				}
			}
			for _, kind := range []string{"interactables", "treasures"} {
				for _, rawContent := range m.Arr(kind) {
					entry := rawContent.(*O)
					if entry.Has("x") && entry.Has("y") &&
						distance(p, point{entry.Int("x"), entry.Int("y")}) < 2 {
						t.Fatalf("%s: patrol %s blocks authored %s", code, expectedID, kind)
					}
				}
			}
			if e.Has("defeatedFlag") || e.Has("positionKey") {
				t.Fatalf("%s: patrol %s must never clone a quest/boss", code, expectedID)
			}
			// The new wave clones the AI/species of the existing generic
			// patrols, preserving regional strength without invented scaling.
			first := all[len(original)+(i%firstWave)].(*O)
			if e.Str("visualType") != first.Str("visualType") || dump(e.Obj("ai")) != dump(first.Obj("ai")) ||
				e.Int("maxHp") != first.Int("maxHp") || e.Int("retaliation") != first.Int("retaliation") {
				t.Fatalf("%s: extra patrol stats/behavior diverged from the area baseline", code)
			}
			effects := e.Obj("onDefeat").Arr("effects")
			if len(effects) != 1 || effects[0].(*O).Str("type") != "grant-gold" ||
				effects[0].(*O).Int("amount") != 1 {
				t.Fatalf("%s: new patrol %s has excessive/unique loot", code, expectedID)
			}
			used[p] = true
			addedTotal++
		}
	}
	// Some densely authored forests deliberately admit only one extra.
	// Still cover the *whole* generated overworld, not just Swordhaven.
	if addedTotal < 200 {
		t.Fatalf("Terra-wide population did not increase enough: %d patrols", addedTotal)
	}
}
