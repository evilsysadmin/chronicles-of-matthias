package main

// Terra's dungeons: seeded mazes with something inside. Each one has a
// named boss that stays dead, an elite who carries the key to a sealed
// cache at the far end, a note that moves the story, a healing font, a
// regular chest and two traps. Positions come from the maze itself
// (distance from the entrance and its dead ends), so a layout change never
// walls anything off.

import (
	"fmt"
	"sort"
	"strings"
)

const dungeonW, dungeonH = 21, 13

type dungeonExtra struct {
	noteLabel, note    string
	fontName           string
	elite              species
	eliteLine          string
	keyID, keyName     string
	cacheLabel, cache  string
	cacheLoot          []string
	trapLabel, trapMsg string
}

var dungeonExtras = map[string]dungeonExtra{
	"C6": {
		noteLabel: "Leer la lista empapada de la escolta",
		note:      "Doce nombres en una lista empapada. Once están tachados con la misma tinta. Junto al último, «Bran, escudero», alguien escribió: «sigue vivo, más abajo». La tinta es de la Cancillería.",
		fontName:  "Ojo de agua dulce",
		elite:     species{"drowned", "el contramaestre ahogado"},
		eliteLine: "El contramaestre ahogado aún lleva al cinto la llave del arcón de la escolta.",
		keyID:     "salinas-chest-key", keyName: "Llave del arcón de la escolta",
		cacheLabel: "Abrir el arcón de la escolta", cache: "El arcón de la escolta guarda la paga que nunca llegaron a cobrar y las armas de los que no volvieron.",
		cacheLoot: []string{"silver-sword", "iron-ring"},
		trapLabel: "Lodo salobre", trapMsg: "El suelo cede en un lodo salado que muerde como cal viva. Dos puntos de daño para cada uno.",
	},
	"A4": {
		noteLabel: "Leer el libro de turnos de la campana",
		note:      "«Tocar tres veces cuando pase la escolta. Paga: el hombre del anillo de bronce. No preguntar su nombre: dice que no tiene.» Al margen, una cuenta en lingotes de Ascuafría.",
		fontName:  "Manantial de la cueva",
		elite:     species{"road-bandit", "el contable de Mano Negra"},
		eliteLine: "El contable de Mano Negra guarda la llave del alijo en una bolsa atada a la muñeca.",
		keyID:     "smugglers-cache-key", keyName: "Llave del alijo",
		cacheLabel: "Abrir el alijo de los contrabandistas", cache: "El alijo: monedas de tres reinos, una cota de anillas sin estrenar y una daga de acero envuelta en terciopelo.",
		cacheLoot: []string{"steel-dagger", "iron-ring"},
		trapLabel: "Cepo de contrabandista", trapMsg: "Un cepo oxidado salta entre las rocas. Los contrabandistas no querían visitas, y lo dejaron muy claro.",
	},
	"E3": {
		noteLabel: "Leer las órdenes del capataz",
		note:      "«Fundir de noche. Nadie pregunta. El molde lo trae V. en persona y se lo lleva en persona. Pagar en lingotes; los lingotes bajan a las calas.» La firma es una corona sin peso dibujada con prisa.",
		fontName:  "Pozo de agua fría",
		elite:     species{"ash-goblin", "el goblin capataz"},
		eliteLine: "El goblin capataz cuelga la llave de la vagoneta de una cadena al cuello.",
		keyID:     "mine-cart-key", keyName: "Llave de la vagoneta",
		cacheLabel: "Abrir la vagoneta cerrada", cache: "La vagoneta cerrada lleva lingotes con la marca de Ascuafría, un hacha de acero y una cota de malla de capataz.",
		cacheLoot: []string{"steel-axe", "steel-chain"},
		trapLabel: "Respiradero de escoria", trapMsg: "Un respiradero escupe escoria al rojo. Dos puntos de daño y un olor a pelo quemado que tardará en irse.",
	},
	"D1": {
		noteLabel: "Leer la inscripción del túmulo central",
		note:      "«Siete reyes juraron aquí. El Silencio aceptó. Quien lea la tablilla en voz alta ante el trono hablará con la voz del Rey; quien la rompa, romperá el Pacto.» Debajo, muy pequeño: «o liberará a quien juró por él».",
		fontName:  "Pila del túmulo",
		elite:     species{"scavenger-knight", "el guerrero del primer rey"},
		eliteLine: "El guerrero del primer rey custodia la llave de hueso del ajuar.",
		keyID:     "barrow-bone-key", keyName: "Llave de hueso",
		cacheLabel: "Abrir el ajuar del rey sin nombre", cache: "El ajuar del rey sin nombre: oro antiguo, una armadura de placas de plata y un escudo que todavía brilla.",
		cacheLoot: []string{"silver-plate", "silver-shield"},
		trapLabel: "Losa del juramento", trapMsg: "Una losa cede bajo el peso de la compañía. Desde el techo cae polvo de huesos y algo más pesado.",
	},
	"E5": {
		noteLabel: "Leer el recetario de la bruja",
		note:      "«Para que un pozo olvide que fue agua: tres hojas de cicuta, un nombre que nadie diga y la paciencia de esperar a que el Silencio pase a cobrar. El Canciller paga bien. El Canciller paga siempre.»",
		fontName:  "Charca limpia",
		elite:     species{"salt-crab", "el familiar de la bruja"},
		eliteLine: "El familiar de la bruja lleva la llave de la alacena entre las pinzas.",
		keyID:     "witch-pantry-key", keyName: "Llave de la alacena",
		cacheLabel: "Abrir la alacena de la bruja", cache: "En la alacena hay frascos que es mejor no abrir, una bolsa de monedas y un bastón de marfil tallado con caras que parpadean.",
		cacheLoot: []string{"ivory-staff", "silver-shield"},
		trapLabel: "Raíz que agarra", trapMsg: "Una raíz se enrosca en los tobillos y aprieta. Dos puntos de daño y un respeto nuevo por la jardinería.",
	},
}

func openSides(grid [][]byte, p point) int {
	n := 0
	for _, s := range stepOrder {
		d := stepDir[s]
		if grid[p.y+d.y][p.x+d.x] == '.' {
			n++
		}
	}
	return n
}

// openFacing is the first direction (N, E, S, W) with floor ahead, so the
// company arrives looking down a corridor rather than at a wall.
func openFacing(grid [][]byte, p point) int {
	for d, step := range []point{{0, -1}, {1, 0}, {0, 1}, {-1, 0}} {
		if grid[p.y+step.y][p.x+step.x] == '.' {
			return d
		}
	}
	return 1
}

func itemLabel(id string) string { return capFirst(strings.ReplaceAll(id, "-", " ")) }

func buildDungeon(code string, bossDrop *O, quests map[string]*areaQuests) *O {
	d := dungeons[code]
	x := dungeonExtras[code]
	level := danger(code) + 1
	slug := camelFlag(d.id)
	grid := maze(saltOf(d.id), dungeonW, dungeonH)
	start := point{1, 1}
	dist := distances(grid, start)
	ordered := make([]point, 0, len(dist))
	for p := range dist {
		ordered = append(ordered, p)
	}
	sort.Slice(ordered, func(i, j int) bool {
		a, b := ordered[i], ordered[j]
		if dist[a] != dist[b] {
			return dist[a] < dist[b]
		}
		if a.x != b.x {
			return a.x < b.x
		}
		return a.y < b.y
	})
	bossPos := ordered[len(ordered)-1]
	var deadEnds []point
	for _, p := range ordered {
		if openSides(grid, p) == 1 && p != start && p != bossPos {
			deadEnds = append(deadEnds, p)
		}
	}
	if len(deadEnds) < 5 {
		panic(fmt.Sprintf("%s: only %d dead ends", d.id, len(deadEnds)))
	}
	n := len(deadEnds)
	notePos, fontPos, chestPos, elitePos, cachePos := deadEnds[0], deadEnds[n/3], deadEnds[n/2], deadEnds[2*n/3], deadEnds[n-1]
	taken := map[point]bool{start: true, bossPos: true, notePos: true, fontPos: true, chestPos: true, elitePos: true, cachePos: true}
	if len(taken) != 7 {
		panic(d.id + ": dungeon features overlap")
	}
	// The cell in front of the start stays free so arrival never lands in a fight.
	for _, s := range stepOrder {
		dd := stepDir[s]
		taken[point{start.x + dd.x, start.y + dd.y}] = true
	}

	foes := dungeonFoes[d.theme]
	var enemies []*O
	for i, k := range []int{2, 3, 4, 5, 6, 7} {
		pos := ordered[len(ordered)*k/8]
		for j := len(ordered) * k / 8; taken[pos] && j < len(ordered)-1; j++ {
			pos = ordered[j+1]
		}
		if taken[pos] {
			continue
		}
		taken[pos] = true
		sp := foes[i%len(foes)]
		enemies = append(enemies, foe(d.id, i, level, sp.visual, sp.name, pos, false, nil))
	}
	eliteFlag := slug + "EliteDefeated"
	enemies = append(enemies, foe(d.id, 8, level+1, x.elite.visual, x.elite.name, elitePos, false, obj(
		"defeatedFlag", eliteFlag,
		"onDefeat", obj("message", "{attacker} derriba a "+x.elite.name+" con {attack}.",
			"effects", A{obj("type", "set", "key", eliteFlag, "value", true), obj("type", "grant-gold", "amount", 6+level*3),
				grantItem(x.keyID, x.keyName, x.eliteLine)},
			"journal", journal(d.id+"-elite", capFirst(x.keyName), x.eliteLine, "†")),
	)))
	bossFlag := slug + "BossDefeated"
	bossEnemy := foe(d.id, 9, level, d.boss.visual, d.boss.name, bossPos, true, obj(
		"maxHp", d.boss.hp, "defeatedFlag", bossFlag,
		"ai", obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 2),
		"blockingMessage", capFirst(d.boss.name)+" cierra el paso.",
		"onDefeat", obj("message", "{attacker} derriba a "+d.boss.name+" con {attack}.",
			"effects", A{obj("type", "set", "key", bossFlag, "value", true), obj("type", "grant-gold", "amount", 10+level*4), bossDrop},
			"journal", obj("id", d.id+"-boss", "title", "Cae "+d.boss.name, "body", bossDrop.Str("description"), "sigil", "†")),
	))
	if d.boss.scale > 0 {
		bossEnemy.Set("visualScale", d.boss.scale)
	}
	enemies = append(enemies, bossEnemy)

	chestFlag := slug + "ChestOpened"
	loot := tier(level+1) + "-" + []string{"sword", "axe", "mace", "spear"}[saltOf(d.id)%4]
	armourKind := "scale"
	if level > 3 {
		armourKind = "chain"
	}
	armour := tier(level+1) + "-" + armourKind
	cacheFlag := slug + "CacheOpened"
	cacheEffects := A{obj("type", "set", "key", cacheFlag, "value", true),
		obj("type", "consume-item", "itemId", x.keyID, "quantity", 1),
		obj("type", "grant-gold", "amount", 30+level*12)}
	for _, id := range x.cacheLoot {
		cacheEffects = append(cacheEffects, obj("type", "grant-item", "itemId", id, "name", itemLabel(id), "description", "Del "+strings.ToLower(strings.TrimPrefix(x.cacheLabel, "Abrir el "))+".", "quantity", 1))
	}
	cacheEffects = append(cacheEffects, xp("terra:"+d.id+":cache:v1", 40+level*10))
	treasures := A{
		obj("id", d.id+"-chest", "kind", "pickup", "visualType", "ember-cache", "x", chestPos.x, "y", chestPos.y,
			"label", "Abrir el cofre", "when", A{flagIs(chestFlag, false)},
			"action", obj("effects", A{obj("type", "set", "key", chestFlag, "value", true), obj("type", "grant-gold", "amount", 15+level*8),
				obj("type", "grant-item", "itemId", loot, "name", itemLabel(loot), "description", "Botín de mazmorra.", "quantity", 1),
				obj("type", "grant-item", "itemId", armour, "name", itemLabel(armour), "description", "Botín de mazmorra.", "quantity", 1)},
				"message", "Un cofre con herrajes de bronce: oro y equipo de calidad.")),
		obj("id", d.id+"-cache", "kind", "pickup", "visualType", "chain-altar", "x", cachePos.x, "y", cachePos.y,
			"label", x.cacheLabel, "lockedLabel", x.cacheLabel+" · cerrado con llave", "when", A{flagIs(cacheFlag, false)},
			"requirements", A{obj("itemId", x.keyID, "quantity", 1, "message", "Cerrado con llave. "+x.eliteLine)},
			"action", obj("effects", cacheEffects, "message", x.cache)),
	}
	fontFlag := slug + "FontUsed"
	interactables := A{
		obj("id", d.id+"-note", "kind", "lore", "visualType", "name-plaque", "x", notePos.x, "y", notePos.y,
			"label", x.noteLabel,
			"action", obj("effects", A{obj("type", "set", "key", slug+"NoteRead", "value", true)}, "message", x.note,
				"journal", journal(d.id+"-note", d.name, x.note, code))),
		obj("id", d.id+"-font", "kind", "lore", "visualType", "shrine", "x", fontPos.x, "y", fontPos.y,
			"label", "Beber del "+x.fontName, "when", A{flagIs(fontFlag, false)},
			"action", obj("effects", A{obj("type", "set", "key", fontFlag, "value", true), obj("type", "heal-party", "amount", 10+level*2),
				obj("type", "restore-spell-points")},
				"message", "El agua del "+x.fontName+" está fría y limpia. La compañía recupera fuerzas y puntos de hechizo.")),
	}

	// Two traps on corridors (cells with exactly two ways), away from the rest.
	traps := A{}
	trapVisual := "chain-plate"
	if d.theme == "ash" {
		trapVisual = "slag-vent"
	}
	for t, frac := range []int{3, 6} {
		for j := len(ordered) * frac / 10; j < len(ordered); j++ {
			p := ordered[j]
			if taken[p] || openSides(grid, p) != 2 {
				continue
			}
			taken[p] = true
			flag := fmt.Sprintf("%sTrap%dSpent", slug, t)
			traps = append(traps, obj("id", fmt.Sprintf("%s-trap-%d", d.id, t), "kind", "trap", "visualType", trapVisual,
				"x", p.x, "y", p.y, "label", x.trapLabel, "when", A{flagIs(flag, false)},
				"action", obj("effects", A{obj("type", "set", "key", flag, "value", true), obj("type", "damage-party", "amount", 1+level/2)},
					"message", x.trapMsg)))
			break
		}
	}

	rows := make([]string, len(grid))
	for i, r := range grid {
		rows[i] = string(r)
	}
	return obj(
		"id", d.id, "version", 1, "progressionKey", d.id+"-v1", "title", d.name, "hudTitle", d.hud,
		"areaCode", code, "regionKind", "dungeon", "dungeonRole", "main", "layoutMode", "authored",
		"grid", rows, "partyStart", obj("x", 1, "y", 1, "direction", openFacing(grid, start)),
		"initialFlags", obj(), "enemies", objs(enemies), "triggers", A{}, "interactables", interactables, "treasures", treasures, "traps", traps,
		"exits", A{obj(
			"id", "dungeon-exit", "kind", "exit", "x", 1, "y", 1, "requiresReturn", true,
			"openLabel", "Salir a "+code+" · "+areas[code].name, "lockedLabel", "La salida está bloqueada", "requirements", A{},
			"action", obj("effects", A{obj("type", "transition-map", "mapId", mapID(code), "entryExitId", strings.ToLower(code)+"-to-dungeon")},
				"message", "La compañía sale a la luz."),
		)},
		"initialJournal", obj("id", d.id+"-arrival", "title", d.name, "body", d.name+", bajo "+code+".", "sigil", code),
		"introMessage", d.name+". El aire huele a cerrado y a algo que no quiere visitas.",
		"arrivalAction", obj("effects", A{}, "message", d.name+". Al fondo de los pasillos espera "+d.boss.name+"."),
	)
}
