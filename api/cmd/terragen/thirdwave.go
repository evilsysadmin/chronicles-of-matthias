package main

import "fmt"

// Terra, third wave: armed camps that fight as a pack, a bounty board in
// Vado de Sal that pays for their leaders, and an optional late dungeon,
// the Tower of Names (A1), for the company that has outgrown the main road.
//
//	Camps: A2 desertores · B1 loba blanca · B6 necrófagos · D5 raqueros · F4 gólem
//	Cazarrecompensas: Vado de Sal (C5), tablón de la plaza
//	Los nombres perdidos: Osric (C1) → Torre de los Nombres (A1) → Osric

type camp struct {
	key, title string
	leader     species
	scale      float64
	members    []species
	loot       []string
	bounty     int
	line       string
	props      []string // set pieces drawn on blocked cells around the camp
}

var campOrder = []string{"A2", "B1", "B6", "D5", "F4"}

var camps = map[string]camp{
	"A2": {"desertores", "Campamento de los Desertores", species{"bandit-captain", "Brenna la Tuerta"}, 0,
		[]species{{"bandit-archer", "ballestero desertor"}, {"bandit-archer", "ballestera desertora"}, {"road-bandit", "desertor"}},
		[]string{"silver-sword", "iron-chain"}, 60,
		"Brenna la Tuerta mandaba una compañía de la Corona antes de que el Rey faltara. Ahora cobra peaje a quien pase por las Colinas Rotas.", []string{"campfire", "tent", "tent", "banner"}},
	"B1": {"loba-blanca", "Cubil de la Loba Blanca", species{"dire-wolf", "la Loba Blanca"}, 1.35,
		[]species{{"dire-wolf", "lobo gris"}, {"dire-wolf", "loba gris"}, {"dire-wolf", "lobezno crecido"}},
		[]string{"silver-shield", "silver-dagger"}, 50,
		"La Loba Blanca guía a la manada que vacía los rediles del norte. Los pastores dicen que entiende cuando hablan de ella.", []string{"ruin", "ruin"}},
	"B6": {"necrofagos", "Fosa de los Necrófagos", species{"ghoul", "el Comehuesos"}, 1.25,
		[]species{{"ghoul", "necrófago"}, {"ghoul", "necrófaga"}},
		[]string{"silver-mace", "silver-scale"}, 55,
		"En la playa de los naufragios algo desentierra a los ahogados antes de que el mar se los lleve. El Comehuesos es el más viejo y el más gordo.", []string{"ruin", "ruin", "banner"}},
	"D5": {"raqueros", "Barcazas de los Raqueros", species{"bandit-captain", "el capitán Ruy"}, 0,
		[]species{{"bandit-archer", "arponero raquero"}, {"road-bandit", "raquero"}, {"bandit-archer", "arponera raquera"}},
		[]string{"silver-spear", "silver-ring"}, 65,
		"El capitán Ruy enciende hogueras en la marisma para que las barcas encallen. Lo que el barro no se queda, se lo queda él.", []string{"campfire", "tent", "banner", "tent"}},
	"F4": {"golem", "Cantera del Gólem", species{"stone-golem", "el Gólem de la Cantera"}, 1.15,
		[]species{{"ash-goblin", "goblin cantero"}, {"ash-goblin", "goblin del martillo"}},
		[]string{"steel-mace", "silver-chain"}, 80,
		"Los goblins de la ceniza despertaron al gólem de la cantera vieja y lo adoran como a un rey. Un rey que aplasta todo lo que se acerca.", []string{"ruin", "ruin", "campfire", "tent"}},
}

func campFlag(code string) string { return "camp" + code + "LeaderDown" }

// campContent places a camp at a free foe slot: the leader on the slot, the
// pack around it and the spoils behind it, there once the leader falls.
func campContent(code, areaID string, level int, slot point) (enemies, treasures []*O) {
	c, ok := camps[code]
	if !ok {
		return nil, nil
	}
	flag := campFlag(code)
	leader := foe(areaID, 20, level+1, c.leader.visual, c.leader.name, slot, true, obj(
		"defeatedFlag", flag,
		"blockingMessage", capFirst(c.leader.name)+" no deja pasar a nadie sin pagar.",
		"onDefeat", obj("message", "{attacker} derriba a "+c.leader.name+" con {attack}.",
			"effects", A{set(flag, true), obj("type", "grant-gold", "amount", 10+level*4)},
			"journal", journal(areaID+"-camp", "Cae "+c.leader.name, c.line+" Ya no.", "†")),
	))
	if c.scale > 0 {
		leader.Set("visualScale", c.scale)
	}
	enemies = append(enemies, leader)
	around := []point{{slot.x - 1, slot.y}, {slot.x + 1, slot.y}, {slot.x, slot.y + 1}}
	for i, m := range c.members {
		enemies = append(enemies, foe(areaID, 21+i, level, m.visual, m.name, around[i], false, nil))
	}
	chestFlag := "camp" + code + "SpoilsTaken"
	items := A{}
	for _, item := range c.loot {
		items = append(items, obj("type", "grant-item", "itemId", item, "name", capFirst(item), "description", "Botín de "+c.title+".", "quantity", 1))
	}
	gold := 20 + level*8
	treasures = append(treasures, obj(
		"id", areaID+"-camp-spoils", "kind", "pickup", "visualType", "chest", "x", slot.x, "y", slot.y-1,
		"label", "Registrar el botín del campamento", "when", A{flagIs(flag, true), flagIs(chestFlag, false)},
		"action", obj("effects", append(A{set(chestFlag, true), obj("type", "grant-gold", "amount", gold)}, items...),
			"message", fmt.Sprintf("Entre los fardos de %s quedan %d monedas y armas de buena factura.", c.title, gold)),
	))
	return enemies, treasures
}

// Vado de Sal's bounty board: one reward per camp leader and a purse for
// the company that clears them all.
const bountyQuest = "terra-bounties"

func bountyBoard() []*O {
	at := door{10, 6, "signpost"}
	var entries []*O
	allPaid := A{}
	for _, code := range campOrder {
		c := camps[code]
		paid := "bounty" + code + "Paid"
		allPaid = append(allPaid, flagIs(paid, true))
		entries = append(entries, questStep("vado-bounty-"+c.key, at,
			fmt.Sprintf("Cobrar la recompensa: %s · %d oro", c.leader.name, c.bounty),
			A{active(bountyQuest), flagIs(campFlag(code), true), flagIs(paid, false)},
			A{obj("type", "claim-reward", "rewardId", "terra:bounty:"+c.key+":v1", "requirements", A{flagIs(campFlag(code), true)},
				"effects", A{set(paid, true), obj("type", "grant-gold", "amount", c.bounty), xp("terra:bounty:"+c.key+":v1", 60)})},
			"El alguacil de Vado de Sal tacha el nombre de "+c.leader.name+" en el tablón y cuenta "+fmt.Sprint(c.bounty)+" monedas.",
			nil, A{flagIs(campFlag(code), true)}, ""))
	}
	entries = append(entries, questStep("vado-bounty-complete", at, "Cobrar la bolsa del tablón · 120 oro",
		append(A{active(bountyQuest)}, allPaid...),
		A{obj("type", "claim-reward", "rewardId", "terra:bounty:all:v1", "requirements", allPaid,
			"effects", A{completeSide(bountyQuest, "El tablón de Vado de Sal está limpio."), obj("type", "grant-gold", "amount", 120),
				xp("terra:bounty:all:v1", 150),
				obj("type", "grant-item", "itemId", "steel-shield", "name", "Steel shield", "description", "El escudo del alguacil, regalo para quien limpió el tablón.", "quantity", 1)})},
		"El alguacil arranca el tablón entero y os da su propio escudo: «Cinco nombres menos. Ya no me queda a quién buscar».",
		journal("vado-bounty-complete", "Cazarrecompensas", "Los cinco campamentos de Terra han caído. Vado de Sal pagó la bolsa del tablón.", "◆"),
		allPaid, ""))
	var list []string
	for _, code := range campOrder {
		list = append(list, fmt.Sprintf("%s (%s)", camps[code].leader.name, code))
	}
	entries = append(entries, questStep("vado-bounty-board", at, "Leer el tablón de recompensas",
		A{flagIs("vadoBountyRead", false)},
		A{set("vadoBountyRead", true), sideQuest(bountyQuest, "Cazarrecompensas",
			"El alguacil de Vado de Sal paga por los jefes de los campamentos que asaltan Terra.",
			"Derrota a los jefes de los campamentos y cobra en el tablón de Vado de Sal (C5): "+joinComma(list)+".", 35)},
		"El tablón de la plaza tiene cinco carteles clavados con puñal. «Se paga en oro. Se paga por cabeza. Preguntad al alguacil.»",
		journal("vado-bounty", "El tablón de Vado de Sal", "Recompensas por "+joinComma(list)+".", "◆"), nil, ""))
	entries = append(entries, questStep("vado-bounty-idle", at, "Leer el tablón de recompensas",
		A{flagIs("vadoBountyRead", true)}, A{},
		"Carteles con nombres tachados y otros que todavía esperan. Los campamentos están en las Colinas Rotas (A2), el norte nevado (B1), la playa de los naufragios (B6), la marisma (D5) y la cantera de ceniza (F4).",
		nil, nil, "").With("persistentVisual", true))
	return entries
}

func joinComma(list []string) string {
	out := ""
	for i, s := range list {
		switch {
		case i == 0:
		case i == len(list)-1:
			out += " y "
		default:
			out += ", "
		}
		out += s
	}
	return out
}

// The Tower of Names: an optional late dungeon in the far north-west.
const towerQuest = "lost-names"

var dungeonLevelBonus = map[string]int{"A1": 2}

func towerPeople() []*O {
	hall := door{11, 10, "building-hall"}
	towerDone := camelFlag("torre-de-los-nombres") + "BossDefeated"
	return []*O{
		questStep("osric-tower-brief", hall, "Hablar con el archivero ciego Osric",
			A{flagIs("vigiliaOsricReported", true), flagIs("osricTowerStarted", false)},
			A{set("osricTowerStarted", true), sideQuest(towerQuest, "Los nombres perdidos",
				"Osric sabe dónde guardaba el Silencio los nombres que borraba.",
				"Sube a la Torre de los Nombres (A1), derrota al Escriba sin Nombre y trae su libro a Osric (C1).", 36)},
			"Osric baja la voz: «Hay una torre en el norte helado donde el Silencio escribe a quién borrar. Si alguien trae ese libro, quizá podamos devolver algún nombre. Es la cosa más peligrosa que os voy a pedir»",
			journal("osric-tower", "La Torre de los Nombres", "El Silencio anota a quién borrar en un libro guardado en la Torre de los Nombres (A1).", "◆"), nil, ""),
		questStep("osric-tower-report", hall, "Entregar el Libro de los Nombres a Osric · 150 oro",
			A{active(towerQuest)},
			A{obj("type", "claim-reward", "rewardId", "terra:lost-names:v1", "requirements", A{flagIs(towerDone, true)},
				"effects", A{completeSide(towerQuest, "Osric guarda el Libro de los Nombres."), set("lostNamesRestored", true),
					obj("type", "grant-gold", "amount", 150), xp("terra:lost-names:v1", 250),
					obj("type", "grant-item", "itemId", "steel-ring", "name", "Steel ring", "description", "Una cota de anillas de la armería de la Vigilia.", "quantity", 1)})},
			"Osric pasa las páginas sin verlas y sonríe cuando sus dedos encuentran un nombre que conoce: «Mi hermana. La había olvidado. Gracias»",
			journal("osric-tower-done", "Los nombres perdidos", "Osric tiene el Libro de los Nombres. Los nombres tachados pueden volver a decirse.", "◆"),
			A{obj("key", towerDone, "truthy", true, "message", "Osric espera: «El Escriba sigue escribiendo en la Torre de los Nombres (A1)»")},
			"Osric · «El Escriba sigue en la Torre de los Nombres (A1)»"),
	}
}

func init() {
	dungeonOrder = append(dungeonOrder, "A1")
	dungeons["A1"] = dungeon{"torre-de-los-nombres", "Torre de los Nombres", "Torre", "tower", boss{"name-scribe", "el Escriba sin Nombre", 64, 1.35}}
	dungeonFoes["tower"] = []species{{"stone-golem", "gólem del archivo"}, {"ghoul", "lector devorado"},
		{"silent-acolyte", "copista del Silencio"}, {"ice-wraith", "nombre olvidado"}}
	dungeonExtras["A1"] = dungeonExtra{
		noteLabel: "Leer el índice de la torre",
		note:      "Un índice de nombres tachados, por orden de fecha. El último es de anoche. Más abajo, en blanco, un hueco del tamaño de cuatro nombres. Debajo, a lápiz: «la compañía de Swordhaven».",
		fontName:  "Tintero de agua clara",
		elite:     species{"stone-golem", "el guardián del índice"},
		eliteLine: "El guardián del índice lleva incrustada en el pecho la llave del scriptorium.",
		keyID:     "scriptorium-key", keyName: "Llave del scriptorium",
		cacheLabel: "Abrir el scriptorium", cache: "En el scriptorium: plumas de plata, tinta que no seca y las armas de los que vinieron antes.",
		cacheLoot: []string{"steel-spear", "steel-splint"},
		trapLabel: "Página suelta", trapMsg: "Una página suelta se pega a la piel y escribe en ella. Duele como un nombre que se olvida.",
	}

	// New species join the wilds; each keeps its own way of fighting.
	biomeFoes["plains"] = append(biomeFoes["plains"], species{"bandit-archer", "ballestero"})
	biomeFoes["forest"] = append(biomeFoes["forest"], species{"dire-wolf", "lobo gris"})
	biomeFoes["hills"] = append(biomeFoes["hills"], species{"bandit-archer", "ballestero de las colinas"})
	biomeFoes["snow"] = append(biomeFoes["snow"], species{"dire-wolf", "lobo de las cumbres"})
	biomeFoes["marsh"] = append(biomeFoes["marsh"], species{"ghoul", "necrófago de la marisma"})
	biomeFoes["ash"] = append(biomeFoes["ash"], species{"stone-golem", "gólem de escoria"})
}

func thirdWaveBossDrops() map[string]*O {
	return map[string]*O{
		"A1": grantItem("book-of-names", "Libro de los Nombres", "El libro donde el Silencio anotaba a quién borrar. Osric, en la Vigilia del Norte, sabrá qué hacer con él."),
	}
}

func thirdWaveStory(s *storyOut) {
	s.people["C5"] = append(s.people["C5"], bountyBoard()...)
	s.people["C1"] = append(s.people["C1"], towerPeople()...)
}

// areaScenery lists the set pieces the renderer draws on impassable cells:
// a camp's fire, tents and banner around its leader, and an old ruin in the
// open lands. They only ever stand on '#' cells, so collision is unchanged.
func areaScenery(code, biome string, grid []string, campSlot *point) A {
	out := A{}
	used := map[point]bool{}
	blocked := func(p point) bool {
		return p.y >= 0 && p.y < len(grid) && p.x >= 0 && p.x < len(grid[p.y]) && grid[p.y][p.x] == '#'
	}
	if campSlot != nil {
		var near []point
		for r := 1; r <= 4 && len(near) < 4; r++ {
			for dy := -r; dy <= r; dy++ {
				for dx := -r; dx <= r; dx++ {
					if abs(dx) != r && abs(dy) != r {
						continue
					}
					p := point{campSlot.x + dx, campSlot.y + dy}
					if blocked(p) && !used[p] && len(near) < 4 {
						near = append(near, p)
						used[p] = true
					}
				}
			}
		}
		props := camps[code].props
		for i, p := range near {
			if i < len(props) {
				out = append(out, obj("type", props[i], "x", p.x, "y", p.y))
			}
		}
	}
	if biome == "plains" || biome == "hills" || biome == "coast" || biome == "snow" {
		salt := saltOf(code)
		var inner []point
		for y := 2; y < len(grid)-2; y++ {
			for x := 2; x < len(grid[y])-2; x++ {
				if p := (point{x, y}); blocked(p) && !used[p] {
					inner = append(inner, p)
				}
			}
		}
		if len(inner) > 0 {
			p := inner[salt%len(inner)]
			out = append(out, obj("type", "ruin", "x", p.x, "y", p.y))
		}
	}
	return out
}
