package main

import "fmt"

// Extra, low-reward patrols in every generated Terra wilderness area.
// Apply AFTER the original reinforcement: already-persisted enemy IDs,
// indices, HP keys, positions, quest outcomes and treasure remain untouched.
// Do not bypass the start/arrival safety perimeter or fill narrow corridors
// just to hit an arbitrary creature quota.
const extraOverworldPatrolLimit = 2

func addOverworldDensityPatrols(m *O, areaCode string) {
	areaID := mapID(areaCode)
	current := m.Arr("enemies")
	// Infer the original ordinary count from the stable *trailing* first
	// wave, not from a contiguous prefix. In maps without quest enemies,
	// ordinary foes and their reinforcements have consecutive foe-N IDs.
	ordinary, firstWaveCount := 0, 0
	for _, candidate := range []int{2, 3, 4} {
		wave := 3
		if candidate >= 4 {
			wave = 4
		}
		start := len(current) - wave
		if start < 0 {
			continue
		}
		match := true
		for i := 0; i < wave; i++ {
			if current[start+i].(*O).Str("id") != fmt.Sprintf("%s-foe-%d", areaID, candidate+i) {
				match = false
				break
			}
		}
		if match {
			ordinary, firstWaveCount = candidate, wave
			break
		}
	}
	if ordinary == 0 {
		panic(areaID + ": missing stable first-wave patrol IDs")
	}
	firstWaveStart := len(current) - firstWaveCount
	rows := parse(dump(m)).(*O).Arr("grid")
	grid := make([][]byte, len(rows))
	for y, raw := range rows {
		grid[y] = []byte(raw.(string))
	}
	start := m.Obj("partyStart")
	spawn := point{start.Int("x"), start.Int("y")}
	walkable := reachable(grid, spawn)
	positions := make([]point, 0, len(current)+extraOverworldPatrolLimit)
	occupied := map[point]bool{}
	for _, raw := range current {
		foe := raw.(*O)
		p := point{foe.Int("x"), foe.Int("y")}
		positions = append(positions, p)
		occupied[p] = true
	}
	content := append(append(A{}, m.Arr("interactables")...), m.Arr("treasures")...)
	dist := func(a, b point) int { return abs(a.x-b.x) + abs(a.y-b.y) }
	salt := saltOf(areaCode)

	for n := 0; n < extraOverworldPatrolLimit; n++ {
		best, bestScore := point{}, -1
		for y := 2; y < len(grid)-2; y++ {
			for x := 2; x < len(grid[y])-2; x++ {
				candidate := point{x, y}
				if grid[y][x] != '.' || !walkable[candidate] || occupied[candidate] ||
					dist(candidate, spawn) < patrolStartClearance {
					continue
				}
				nearGate := false
				for _, raw := range m.Arr("exits") {
					e := raw.(*O)
					if dist(candidate, point{e.Int("x"), e.Int("y")}) < patrolGateClearance {
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
					if e.Has("x") && e.Has("y") &&
						dist(candidate, point{e.Int("x"), e.Int("y")}) < 2 {
						nearContent = true
						break
					}
				}
				if nearContent {
					continue
				}
				nearest := 999
				for _, existing := range positions {
					if d := dist(candidate, existing); d < nearest {
						nearest = d
					}
				}
				if nearest < 3 {
					continue
				}
				score := nearest*10 + (x*17+y*31+salt+n*7)%11
				if score > bestScore {
					best, bestScore = candidate, score
				}
			}
		}
		// Forests with many authored foes, exits and interactions can have
		// room for just one. Keep the safe spawn budget, never force a second.
		if bestScore < 0 {
			break
		}
		source := current[firstWaveStart+n%firstWaveCount].(*O)
		foe := parse(dump(source)).(*O)
		index := ordinary + firstWaveCount + n
		foe.Set("id", fmt.Sprintf("%s-foe-%d", areaID, index))
		foe.Set("hpKey", fmt.Sprintf("%sFoe%dHp", camelFlag(areaID), index))
		foe.Set("x", best.x)
		foe.Set("y", best.y)
		// The new wave is an encounter-density change, not a gold-farming
		// multiplier or another source of quest drops.
		for _, raw := range foe.Obj("onDefeat").Arr("effects") {
			effect := raw.(*O)
			if effect.Str("type") == "grant-gold" {
				effect.Set("amount", 1)
			}
		}
		current = append(current, foe)
		positions = append(positions, best)
		occupied[best] = true
	}
	m.Set("enemies", current)
}
