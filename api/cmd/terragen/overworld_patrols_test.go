package main

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestTerraOverworldPatrolsPreserveExistingWorld(t *testing.T) {
	quests := story().areas
	all := buildAll()
	newCount := 0
	for _, code := range areaOrder {
		m := all[mapID(code)]
		before := buildArea(code, quests)
		previous := before.Arr("enemies")
		after := m.Arr("enemies")
		ordinary := 0
		for i, raw := range previous {
			if raw.(*O).Str("id") != fmt.Sprintf("%s-foe-%d", mapID(code), i) {
				break
			}
			ordinary++
		}
		extra := 3
		if ordinary >= 4 {
			extra = 4
		}
		if len(after) != len(previous)+extra {
			t.Fatalf("%s: expected %d+%d, got %d", code, len(previous), extra, len(after))
		}
		// Existing enemy order matters: saves remember kills by array index.
		for i := range previous {
			if dump(previous[i]) != dump(after[i]) {
				t.Fatalf("%s: changed saved enemy at index %d", code, i)
			}
		}
		rows := parse(dump(m)).(*O).Arr("grid")
		grid := make([][]byte, len(rows))
		for y, raw := range rows {
			grid[y] = []byte(raw.(string))
		}
		start := m.Obj("partyStart")
		spawn := point{start.Int("x"), start.Int("y")}
		accessible := reachable(grid, spawn)
		used := map[point]bool{}
		originalGold := 0
		for _, raw := range previous[:ordinary] {
			for _, effect := range raw.(*O).Obj("onDefeat").Arr("effects") {
				if e := effect.(*O); e.Str("type") == "grant-gold" {
					originalGold += e.Int("amount")
				}
			}
		}
		addedGold := 0
		for _, raw := range previous {
			e := raw.(*O)
			used[point{e.Int("x"), e.Int("y")}] = true
		}
		manhattan := func(a, b point) int { return abs(a.x-b.x) + abs(a.y-b.y) }
		for i, raw := range after[len(previous):] {
			e := raw.(*O)
			p := point{e.Int("x"), e.Int("y")}
			if !accessible[p] || used[p] || manhattan(p, spawn) < patrolStartClearance {
				t.Fatalf("%s: extra patrol %d on spawn, occupied or unreachable tile %v", code, i, p)
			}
			if e.Str("id") != fmt.Sprintf("%s-foe-%d", mapID(code), ordinary+i) {
				t.Fatalf("%s: unexpected patrol ID %s", code, e.Str("id"))
			}
			if e.Str("hpKey") != fmt.Sprintf("%sFoe%dHp", camelFlag(mapID(code)), ordinary+i) {
				t.Fatalf("%s: unexpected HP identity for %s", code, e.Str("id"))
			}
			for _, rawExit := range m.Arr("exits") {
				gate := rawExit.(*O)
				if manhattan(p, point{gate.Int("x"), gate.Int("y")}) < patrolGateClearance {
					t.Fatalf("%s: patrol %s within immediate arrival threat radius of exit %s", code, e.Str("id"), gate.Str("id"))
				}
			}
			for _, kind := range []string{"interactables", "treasures"} {
				for _, rawContent := range m.Arr(kind) {
					c := rawContent.(*O)
					if c.Has("x") && c.Has("y") && manhattan(p, point{c.Int("x"), c.Int("y")}) < 2 {
						t.Fatalf("%s: patrol blocks %s content %s", code, kind, c.Str("id"))
					}
				}
			}
			if e.Has("defeatedFlag") || e.Has("positionKey") {
				t.Fatalf("%s: generic patrol must not duplicate a boss/quest receipt", code)
			}
			goldEffects := 0
			for _, rawEffect := range e.Obj("onDefeat").Arr("effects") {
				effect := rawEffect.(*O)
				if effect.Str("type") != "grant-gold" {
					t.Fatalf("%s: reinforced patrol %s has non-coin loot", code, e.Str("id"))
				}
				goldEffects++
				addedGold += effect.Int("amount")
				source := previous[(saltOf(code)+i)%ordinary].(*O)
				sourceGold := source.Obj("onDefeat").Arr("effects")[0].(*O).Int("amount")
				if effect.Int("amount") != max(1, sourceGold/2) {
					t.Fatalf("%s: patrol %s drops %d gold instead of %d",
						code, e.Str("id"), effect.Int("amount"), max(1, sourceGold/2))
				}
			}
			if goldEffects != 1 {
				t.Fatalf("%s: reinforced patrol %s lacks exactly one coin reward", code, e.Str("id"))
			}
			used[p] = true
			newCount++
		}
		// The world feels busier without making equipment trivial to buy.
		// Two baseline level-1 foes plus three patrols may add at most 75%
		// of baseline coin supply; later areas have a stricter 50% ratio.
		if originalGold <= 0 || addedGold*4 > originalGold*3 {
			t.Fatalf("%s: patrol gold inflation: original=%d additional=%d", code, originalGold, addedGold)
		}
	}
	if newCount < 100 {
		t.Fatalf("expected a meaningful Terra-wide density increase, got %d", newCount)
	}
}

func TestGeneratedOverworldBytesMatchCommittedFiles(t *testing.T) {
	// The public generator's -check gate diagnoses which files are stale,
	// while this contract pinpoints the exact first inconsistent field.
	maps := buildAll()
	root := repoRoot()
	for _, code := range areaOrder {
		mapID := mapID(code)
		m := maps[mapID]
		contractSpanish(m)
		want := dump(m) + "\n"
		got, err := os.ReadFile(filepath.Join(root, frontendMaps, mapID+".json"))
		if err != nil {
			t.Fatalf("%s: %v", code, err)
		}
		if want == string(got) {
			continue
		}
		i := 0
		for i < len(want) && i < len(got) && want[i] == got[i] {
			i++
		}
		from := i - 65
		if from < 0 { from = 0 }
		until := i + 100
		if until > len(want) { until = len(want) }
		gotUntil := i + 100
		if gotUntil > len(got) { gotUntil = len(got) }
		t.Errorf("%s: mismatch at byte %d (generated=%d, committed=%d)\ngenerated: %q\ncommitted: %q",
			code, i, len(want), len(got), want[from:until], got[from:gotUntil])
	}
}
