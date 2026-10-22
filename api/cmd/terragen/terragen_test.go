package main

import (
	"fmt"
	"strings"
	"testing"
)

func TestBuildIsDeterministicAndRoundTrips(t *testing.T) {
	first, second := buildAll(), buildAll()
	for id, m := range first {
		a, b := dump(m), dump(second[id])
		if a != b {
			t.Fatalf("%s differs between two builds", id)
		}
		if dump(parse(a)) != a {
			t.Fatalf("%s does not survive a parse/dump round trip", id)
		}
	}
}

func TestDumpMatchesPythonJSON(t *testing.T) {
	got := dump(obj("a", A{}, "b", obj(), "c", "ñ \"q\" \\ <&>\n", "d", 1.5, "e", 2.0, "f", A{1, true, nil}))
	want := "{\n  \"a\": [],\n  \"b\": {},\n  \"c\": \"ñ \\\"q\\\" \\\\ <&>\\n\",\n  \"d\": 1.5,\n  \"e\": 2.0,\n  \"f\": [\n    1,\n    true,\n    null\n  ]\n}"
	if got != want {
		t.Fatalf("got\n%s\nwant\n%s", got, want)
	}
}

func TestEveryGateArrivesSomewhere(t *testing.T) {
	root := repoRoot()
	manifests := buildAll()
	for id, m := range patchExisting(root) {
		manifests[id] = m
	}
	fixArrivals(root, manifests) // panics on a missing arrival exit
}

func TestTheFinalActHasThreeEndings(t *testing.T) {
	throne := buildThrone()
	endings := map[string]bool{}
	for _, raw := range throne.Arr("interactables") {
		text := dump(raw)
		for _, ending := range []string{"restored", "broken", "regency"} {
			if strings.Contains(text, `"value": "`+ending+`"`) {
				endings[ending] = true
			}
		}
	}
	if len(endings) != 3 {
		t.Fatalf("endings found: %v", endings)
	}
}


// Test every registered expedition dungeon, including later expansion waves.
// A hand-maintained list of just the first five once missed four generated maps.
func TestEveryRegisteredDungeonKeepsOriginalEncountersAndSpacedReinforcements(t *testing.T) {
	manifests := buildAll()
	originalSlots := []int{0, 1, 2, 3, 10, 4, 11, 5, 12, 8, 9}
	wantSlots := append(append([]int(nil), originalSlots...), 13, 14)

	for _, code := range dungeonOrder {
		id := dungeons[code].id
		t.Run(id, func(t *testing.T) {
			m := manifests[id]
			if m == nil {
				t.Fatalf("registered dungeon %s has no generated manifest", id)
			}
			enemies := m.Arr("enemies")
			if len(enemies) != len(wantSlots) {
				t.Fatalf("expected 11 saved foes + 2 optional reinforcements, got %d", len(enemies))
			}
			startRaw := m.Obj("partyStart")
			start := point{startRaw.Int("x"), startRaw.Int("y")}
			grid := make([][]byte, 0, len(m.Arr("grid")))
			for _, row := range m.Arr("grid") {
				grid = append(grid, []byte(row.(string)))
			}
			reachable := distances(grid, start)
			occupied := map[point]bool{start: true}
			for _, group := range []string{"triggers", "interactables", "treasures", "traps", "exits"} {
				for _, raw := range m.Arr(group) {
					entry := raw.(*O)
					occupied[point{entry.Int("x"), entry.Int("y")}] = true
				}
			}
			seenIDs, seenHPKeys := map[string]bool{}, map[string]bool{}
			for i, raw := range enemies {
				enemy := raw.(*O)
				pos := point{enemy.Int("x"), enemy.Int("y")}
				wantID := fmt.Sprintf("%s-foe-%d", id, wantSlots[i])
				wantHP := fmt.Sprintf("%sFoe%dHp", camelFlag(id), wantSlots[i])
				if enemy.Str("id") != wantID || enemy.Str("hpKey") != wantHP {
					t.Fatalf("index %d: got %s/%s, want %s/%s (saved slain-enemy index must not shift)",
						i, enemy.Str("id"), enemy.Str("hpKey"), wantID, wantHP)
				}
				if seenIDs[wantID] || seenHPKeys[wantHP] {
					t.Fatalf("duplicate enemy identity at index %d", i)
				}
				seenIDs[wantID], seenHPKeys[wantHP] = true, true

				if i >= len(originalSlots) {
					if !reachable[pos] && !(pos == start) {
						t.Fatalf("new foe %s is unreachable at %v", wantID, pos)
					}
					if occupied[pos] {
						t.Fatalf("new foe %s collides with prior enemy, trap, item or gate at %v", wantID, pos)
					}
					if abs(pos.x-start.x)+abs(pos.y-start.y) < 5 {
						t.Fatalf("new foe %s has no arrival breathing room", wantID)
					}
					for _, previous := range enemies[:i] {
						old := previous.(*O)
						if abs(old.Int("x")-pos.x)+abs(old.Int("y")-pos.y) < 3 {
							t.Fatalf("new foe %s stands too close to %s", wantID, old.Str("id"))
						}
					}
					if enemy.Get("optional") != true || enemy.Has("defeatedFlag") {
						t.Fatalf("new foe %s must be optional without story flags", wantID)
					}
					onDefeat := enemy.Obj("onDefeat")
					if onDefeat == nil {
						t.Fatalf("new foe %s has no ordinary reward contract", wantID)
					}
					effects := onDefeat.Arr("effects")
					if len(effects) != 1 || effects[0].(*O).Str("type") != "grant-gold" {
						t.Fatalf("new foe %s must not duplicate loot, quest or XP effects", wantID)
					}
				}
				occupied[pos] = true
			}
			if !enemies[9].(*O).Has("defeatedFlag") || !enemies[10].(*O).Has("defeatedFlag") {
				t.Fatalf("unique elite/boss story flags must remain at original positions")
			}
			if len(m.Arr("traps")) != 3 || len(m.Arr("treasures")) != 2 || len(m.Arr("interactables")) != 2 {
				t.Fatalf("original dungeon traps and quest objects changed")
			}
		})
	}
}
