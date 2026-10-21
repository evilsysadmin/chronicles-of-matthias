package main

import (
	"fmt"
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
		for _, raw := range previous {
			e := raw.(*O)
			used[point{e.Int("x"), e.Int("y")}] = true
		}
		manhattan := func(a, b point) int { return abs(a.x-b.x) + abs(a.y-b.y) }
		for i, raw := range after[len(previous):] {
			e := raw.(*O)
			p := point{e.Int("x"), e.Int("y")}
			if !accessible[p] || used[p] || manhattan(p, spawn) < 4 {
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
				if manhattan(p, point{gate.Int("x"), gate.Int("y")}) < 3 {
					t.Fatalf("%s: patrol blocks exit %s", code, gate.Str("id"))
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
			used[p] = true
			newCount++
		}
	}
	if newCount < 100 {
		t.Fatalf("expected a meaningful Terra-wide density increase, got %d", newCount)
	}
}
