// Command terragen writes Chronicles' Terra: the overworld A1..F6, its
// towns, dungeons, story and side quests, as runtime map manifests.
//
//	cd api && go run ./cmd/terragen          # write
//	cd api && go run ./cmd/terragen -check   # fail if committed maps are stale
//
// Manifests are written twice, byte for byte: the game reads
// frontend/src/chronicles/maps and the API embeds
// api/internal/chronicles/content/maps to validate transitions. Every
// other map in those folders is hand-authored and is only mirrored.
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	frontendMaps = "frontend/src/chronicles/maps"
	apiMaps      = "api/internal/chronicles/content/maps"
)

func repoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	for {
		if info, err := os.Stat(filepath.Join(dir, frontendMaps)); err == nil && info.IsDir() {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			panic("terragen: run it inside the chronicles-of-matthias repository")
		}
		dir = parent
	}
}

func buildAll() map[string]*O {
	s := story()
	drops := bossDrops()
	manifests := map[string]*O{}
	for _, code := range areaOrder {
		manifests[mapID(code)] = buildArea(code, s.areas)
	}
	for _, code := range townOrder {
		manifests[towns[code].id] = buildTown(code, s.people[code])
	}
	for _, code := range dungeonOrder {
		manifests[dungeons[code].id] = buildDungeon(code, drops[code], s.areas)
	}
	for id, m := range templeMaps() {
		manifests[id] = m
	}
	return manifests
}

func readMap(root, id string) *O {
	text, err := os.ReadFile(filepath.Join(root, frontendMaps, id+".json"))
	if err != nil {
		panic(err)
	}
	return parseObj(string(text))
}

// patchExisting gives the hand-authored C3 and D3 their edge gates into Terra.
func patchExisting(root string) map[string]*O {
	patched := map[string]*O{}
	for _, code := range existingOrder {
		id := existing[code]
		data := readMap(root, id)
		data.Set("areaCode", code)
		if !data.Has("biome") {
			biome := "plains"
			if code == "D3" {
				biome = "forest"
			}
			data.Set("biome", biome)
		}
		rows := data.Arr("grid")
		grid := make([][]byte, len(rows))
		for i, r := range rows {
			grid[i] = []byte(r.(string))
		}
		ids := map[string]bool{}
		for _, e := range data.Arr("exits") {
			ids[e.(*O).Str("id")] = true
		}
		// C3's north gate is Swordhaven; its way to C2 opens further west.
		local := map[string]point{}
		for k, v := range gates {
			local[k] = v
		}
		if code == "C3" {
			local["N"] = point{4, 1}
			local["E"] = point{19, 10}
		}
		exits := data.Arr("exits")
		for _, side := range gateOrder {
			dst := neighbour(code, side)
			if dst == "" || ids[gateExitID(code, dst)] {
				continue
			}
			g := local[side]
			grid[g.y][g.x] = '.'
			exits = append(exits, exitTo(gateExitID(code, dst), g.x, g.y, nil, "Ir a "+dst+" · "+areas[dst].name,
				"El paso está cortado", mapID(dst), gateExitID(dst, code), "La compañía entra en "+dst+"."))
		}
		data.Set("exits", exits)
		newRows := make([]string, len(grid))
		for i, r := range grid {
			newRows[i] = string(r)
		}
		data.Set("grid", newRows)
		start := data.Obj("partyStart")
		open := reachable(grid, point{start.Int("x"), start.Int("y")})
		for _, e := range exits {
			ex := e.(*O)
			if !open[point{ex.Int("x"), ex.Int("y")}] {
				panic(fmt.Sprintf("%s: exit %s unreachable", code, ex.Str("id")))
			}
		}
		patched[id] = data
	}
	swordhaven := readMap(root, "swordhaven-first-book")
	old := "La hoja de ruta lleva a las Marismas de Sal. Prepárate para viajar a Vado de Sal."
	text := dump(swordhaven)
	if strings.Contains(text, old) {
		patched["swordhaven-first-book"] = parseObj(strings.ReplaceAll(text, old,
			"La hoja de ruta lleva a las Marismas de Sal. Viaja a Vado de Sal (C5): sal al Camino (C3) y baja al sur por C4."))
	}
	return patched
}

// fixArrivals checks that every gate's entryExitId exists on the other side.
func fixArrivals(root string, manifests map[string]*O) {
	for _, id := range sortedKeys(manifests) {
		m := manifests[id]
		for _, raw := range m.Arr("exits") {
			exit := raw.(*O)
			for _, e := range exit.Obj("action").Arr("effects") {
				effect := e.(*O)
				if effect.Str("type") != "transition-map" {
					continue
				}
				target := manifests[effect.Str("mapId")]
				if target == nil {
					target = readMap(root, effect.Str("mapId"))
				}
				found := false
				for _, t := range target.Arr("exits") {
					if t.(*O).Str("id") == effect.Str("entryExitId") {
						found = true
					}
				}
				if !found {
					panic(fmt.Sprintf("%s/%s arrives at missing exit %s/%s", id, exit.Str("id"), effect.Str("mapId"), effect.Str("entryExitId")))
				}
			}
		}
	}
}

// sync writes (or checks) one file in both map folders. Generated manifests
// come from the table; every other frontend map is mirrored into the API.
func sync(root string, outputs map[string][]byte, check bool) (stale []string) {
	for _, name := range sortedKeys(outputs) {
		for _, dir := range []string{frontendMaps, apiMaps} {
			path := filepath.Join(root, dir, name)
			current, err := os.ReadFile(path)
			if err == nil && bytes.Equal(current, outputs[name]) {
				continue
			}
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				panic(err)
			}
			rel := filepath.Join(dir, name)
			stale = append(stale, rel)
			if !check {
				if err := os.WriteFile(path, outputs[name], 0o644); err != nil {
					panic(err)
				}
				fmt.Println("wrote", rel)
			}
		}
	}
	// A map the API embeds but the game no longer ships is stale too.
	entries, _ := os.ReadDir(filepath.Join(root, apiMaps))
	for _, e := range entries {
		if _, ok := outputs[e.Name()]; !ok && strings.HasSuffix(e.Name(), ".json") {
			rel := filepath.Join(apiMaps, e.Name())
			stale = append(stale, rel)
			if !check {
				_ = os.Remove(filepath.Join(root, rel))
				fmt.Println("removed", rel)
			}
		}
	}
	sort.Strings(stale)
	return stale
}

func main() {
	check := flag.Bool("check", false, "fail if committed manifests differ from the generated ones")
	flag.Parse()
	root := repoRoot()
	manifests := buildAll()
	for id, m := range patchExisting(root) {
		manifests[id] = m
	}
	fixArrivals(root, manifests)

	outputs := map[string][]byte{}
	entries, err := os.ReadDir(filepath.Join(root, frontendMaps))
	if err != nil {
		panic(err)
	}
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".json") {
			data, err := os.ReadFile(filepath.Join(root, frontendMaps, e.Name()))
			if err != nil {
				panic(err)
			}
			outputs[e.Name()] = data
		}
	}
	for id, m := range manifests {
		outputs[id+".json"] = []byte(dump(m) + "\n")
	}
	stale := sync(root, outputs, *check)
	if *check && len(stale) > 0 {
		for _, s := range stale {
			fmt.Fprintln(os.Stderr, "stale:", s)
		}
		fmt.Fprintln(os.Stderr, "Terra manifests are stale: run `cd api && go run ./cmd/terragen`")
		os.Exit(1)
	}
}
