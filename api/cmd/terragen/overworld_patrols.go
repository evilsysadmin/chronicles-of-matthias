package main

import (
	"fmt"
)

// reinforceOverworld adds modest, deterministic, ordinary patrols to the
// existing Terra maps AFTER terrain generation. This deliberately does not
// touch map topology, quest foes, unique drops, or old enemy array indices:
// older saved expeditions retain their slainEnemies indices and wounds.
// New HP keys are reconciled on map entry by Chronicles' existing save path.
// A fresh travel arrival materializes directly on an exit tile. Creatures
// can move and attack in the same enemy turn (including range-3 archers),
// so neither the start nor any authored gate may open in immediate range.
const (
	patrolStartClearance = 7
	patrolGateClearance = 6
)

func reinforceOverworld(m *O, areaCode string) {
	areaID := mapID(areaCode)
	current := m.Arr("enemies")
	var ordinary []*O
	// Only the original 0..N-1 common foes precede authored quests and
	// camps. Some camp leaders also use the ID prefix -foe-20, and must NEVER
	// be cloned: they carry unique rewards and defeat flags.
	for i, entry := range current {
		enemy := entry.(*O)
		if enemy.Str("id") != fmt.Sprintf("%s-foe-%d", areaID, i) {
			break
		}
		ordinary = append(ordinary, enemy)
	}
	if len(ordinary) < 2 || len(ordinary) > 4 {
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
				if row[x] != '.' || occupied[candidate] || distance(candidate, spawn) < patrolStartClearance {
					continue
				}
				nearGate := false
				for _, raw := range exits {
					e := raw.(*O)
					if distance(candidate, point{e.Int("x"), e.Int("y")}) < patrolGateClearance {
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
		// Patrol reinforcement adds encounters, not another full economy.
		// Cut only the new ordinary patrol's coin reward in half. Original
		// enemies, quest receipts, camp bosses and their rewards are unchanged.
		for _, raw := range foe.Obj("onDefeat").Arr("effects") {
			effect := raw.(*O)
			if effect.Str("type") == "grant-gold" {
				effect.Set("amount", max(1, effect.Int("amount")/2))
			}
		}
		// Additional enemies should bring NEW tactics, not just more copies.
		// Pick a native species with an unseen real AI signature when possible.
		// Grasslands need a ranged third signature; this patrol-only species
		// does NOT alter the existing biome generation or saved enemy slots.
		biome := areas[areaCode].biome
		candidates := biomeFoes[biome]
		if biome == "plains" {
			candidates = append(append([]species(nil), candidates...),
				species{visual: "bandit-archer", name: "ballestero del camino"})
		}
		for _, species := range candidates {
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
		// B2's first ordinary reinforcement is a hill orc, keeping its stable
		// slot, HP key, spawn cell and reward. Authored enemies are untouched.
		if areaCode == "B2" && n == 0 {
			foe.Set("visualType", "orc-raider")
			foe.Set("name", "orco saqueador del brezal")
			foe.Set("ai", aiFor("orc-raider"))
			foe.Set("agility", 2)
			foe.Obj("onDefeat").Set("message", "{attacker} acaba con orco saqueador del brezal usando {attack}.")
		}
		// Independent new species reuse existing ordinary reinforcement slots.
		// Stable indexes, HP keys, coordinates, stats, gold and quest foes remain unchanged.
		if areaCode == "B2" && n == 1 {
			foe.Set("visualType", "gnoll")
			foe.Set("name", "gnoll merodeador del brezal")
			foe.Set("ai", aiFor("gnoll"))
			foe.Set("agility", 3)
			foe.Obj("onDefeat").Set("message", "{attacker} acaba con gnoll merodeador del brezal usando {attack}.")
		}
		if areaCode == "F3" && n == 0 {
			foe.Set("visualType", "hellhound")
			foe.Set("name", "sabueso infernal")
			foe.Set("ai", aiFor("hellhound"))
			foe.Set("agility", 3)
			foe.Obj("onDefeat").Set("message", "{attacker} acaba con sabueso infernal usando {attack}.")
		}
		current = append(current, foe)
		foePositions = append(foePositions, best)
		occupied[best] = true
	}
	m.Set("enemies", current)
}
