package main

import (
	"fmt"
	"strings"
)

// reinforceOverworld adds modest, deterministic, ordinary patrols to the
// existing Terra maps AFTER terrain generation. This deliberately does not
// touch map topology, quest foes, unique drops, or old enemy array indices:
// older saved expeditions retain their slainEnemies indices and wounds.
// New HP keys are reconciled on map entry by Chronicles' existing save path.
func reinforceOverworld(m *O, areaCode string) {
	areaID := mapID(areaCode)
	current := m.Arr("enemies")
	var ordinary []*O
	for _, entry := range current {
		enemy := entry.(*O)
		if strings.HasPrefix(enemy.Str("id"), areaID+"-foe-") {
			ordinary = append(ordinary, enemy)
		}
	}
	if len(ordinary) == 0 {
		panic(areaID + ": missing ordinary enemies for patrol reinforcement")
	}
	target := 3
	if len(ordinary) >= 4 {
		target = 4
	}
	rows := parse(dump(m)).(*O).Arr("grid")
	start := m.Obj("partyStart")
	spawn := point{start.Int("x"), start.Int("y")}
	exits := m.Arr("exits")
	var content []any
	content = append(content, m.Arr("interactables")...)
	content = append(content, m.Arr("treasures")...)
	foePositions := make([]point, 0, len(current)+target)
	occupied := map[point]bool{}
	for _, raw := range current {
		e := raw.(*O)
		p := point{e.Int("x"), e.Int("y")}
		foePositions = append(foePositions, p)
		occupied[p] = true
	}
	salt := saltOf(areaCode)
	seenBehaviors := map[string]bool{}
	for _, raw := range current {
		foe := raw.(*O)
		seenBehaviors[signature(foe.Obj("ai"))] = true
	}
	distance := func(a, b point) int { return abs(a.x-b.x) + abs(a.y-b.y) }
	for n := 0; n < target; n++ {
		best, bestScore := point{}, -1
		for y := 2; y < len(rows)-2; y++ {
			row := rows[y].(string)
			for x := 2; x < len(row)-2; x++ {
				candidate := point{x, y}
				if row[x] != '.' || occupied[candidate] || distance(candidate, spawn) < 4 {
					continue
				}
				nearGate := false
				for _, raw := range exits {
					e := raw.(*O)
					if distance(candidate, point{e.Int("x"), e.Int("y")}) < 3 {
						nearGate = true
						break
					}
				}
				if nearGate {
					continue
				}
				nearContent := false
				for _, raw := range content {
					e := raw.(*O)
					if e.Has("x") && e.Has("y") && distance(candidate, point{e.Int("x"), e.Int("y")}) < 2 {
						nearContent = true
						break
					}
				}
				if nearContent {
					continue
				}
				nearest := 999
				for _, foe := range foePositions {
					if d := distance(candidate, foe); d < nearest {
						nearest = d
					}
				}
				if nearest < 3 {
					continue
				}
				// Disperse patrols rather than piling them onto the starting
				// square; stable tie-breaking ensures byte-identical manifests.
				score := nearest*10 + (x*17+y*31+salt)%11
				if score > bestScore {
					best, bestScore = candidate, score
				}
			}
		}
		if bestScore < 0 {
			panic(fmt.Sprintf("%s: only %d/%d safe new patrol cells", areaID, n, target))
		}
		// Clone only generic foes. Their normal gold reward/AI/stats are
		// appropriate for this map, unlike named bosses or mission targets.
		source := ordinary[(salt+n)%len(ordinary)]
		foe := parse(dump(source)).(*O)
		index := len(ordinary) + n
		foe.Set("id", fmt.Sprintf("%s-foe-%d", areaID, index))
		foe.Set("hpKey", fmt.Sprintf("%sFoe%dHp", camelFlag(areaID), index))
		foe.Set("x", best.x)
		foe.Set("y", best.y)
		// Additional enemies should bring NEW tactics, not just more copies.
		// Pick a native species with an unseen real AI signature when possible.
		for _, species := range biomeFoes[areas[areaCode].biome] {
			ai := aiFor(species.visual)
			if seenBehaviors[signature(ai)] {
				continue
			}
			foe.Set("visualType", species.visual)
			foe.Set("name", species.name)
			foe.Set("ai", ai)
			foe.Set("agility", speedFor(species.visual, danger(areaCode)))
			foe.Obj("onDefeat").Set("message", "{attacker} acaba con "+species.name+" usando {attack}.")
			break
		}
		seenBehaviors[signature(foe.Obj("ai"))] = true
		current = append(current, foe)
		foePositions = append(foePositions, best)
		occupied[best] = true
	}
	m.Set("enemies", current)
}
