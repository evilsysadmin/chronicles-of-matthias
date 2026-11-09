package main

import "fmt"

// Extra, low-reward patrols in every generated Terra wilderness area.
// Apply AFTER the original reinforcement: already-persisted enemy IDs,
// indices, HP keys, positions, quest outcomes and treasure remain untouched.
// Do not bypass the start/arrival safety perimeter or fill narrow corridors
// just to hit an arbitrary creature quota. Two existing saved patrol slots
// retain their legacy 3-cell clearance; only the additional population
// uses a 2-cell spacing (never adjacent to or overlapping another foe).
const extraOverworldPatrolLimit = 8

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

	added := 0
	for n := 0; n < extraOverworldPatrolLimit; n++ {
		minSpacing := 3
		if n >= 2 {
			minSpacing = 2
		}
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
				if nearest < minSpacing {
					continue
				}
				score := nearest*10 + (x*17+y*31+salt+n*7)%11
				if score > bestScore {
					best, bestScore = candidate, score
				}
			}
		}
		// Do not shift the legacy first one/two patrol slots in saved games.
		// If the second 3-cell slot was impossible, retry at 2-cell spacing
		// only for NEW identities, preserving the original first slot.
		if bestScore < 0 {
			if n < 2 {
				continue
			}
			break
		}
		source := current[firstWaveStart+added%firstWaveCount].(*O)
		foe := parse(dump(source)).(*O)
		index := ordinary + firstWaveCount + added
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
		added++
	}
	// The West Road is already populated, but almost all of its extra
	// encounters are stationary sentries or free-roaming mobs. Give ONE
	// existing, low-reward goblin a visible four-cell patrol. This is a
	// behaviour change only: keep its saved ID, HP key, array index, start
	// cell, stats, coin reward and all quest foes untouched.
	if areaCode == "B3" {
		var patrol *O
		for _, raw := range current {
			if e := raw.(*O); e.Str("id") == "terra-b3-foe-8" {
				patrol = e
				break
			}
		}
		if patrol == nil || patrol.Str("visualType") != "ash-goblin" ||
			patrol.Int("x") != 15 || patrol.Int("y") != 9 {
			panic("B3: expected saved goblin patrol slot changed; re-audit before updating route")
		}
		route := A{
			obj("x", 15, "y", 9),
			obj("x", 15, "y", 10),
			obj("x", 14, "y", 10),
			obj("x", 14, "y", 9),
		}
		for _, raw := range route {
			p := raw.(*O)
			if grid[p.Int("y")][p.Int("x")] != '.' {
				panic("B3: patrol route no longer traversable")
			}
			for _, other := range current {
				e := other.(*O)
				if e.Str("id") != patrol.Str("id") &&
					e.Int("x") == p.Int("x") && e.Int("y") == p.Int("y") {
					panic("B3: patrol route overlaps another enemy's spawn")
				}
			}
		}
		patrol.Obj("ai").Set("movement", "patrol-route").Set("patrolRoute", route)
	}
	m.Set("enemies", current)
}
