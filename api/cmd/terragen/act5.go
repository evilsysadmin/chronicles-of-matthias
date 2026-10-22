package main

// Act V of «El rey desaparecido»: the Temple Under the Crown (F6).
//
// Three hand-drawn floors under the Umbral Bajo la Corona. They are separate
// maps joined by stairs, because a Chronicles map has no walls that open: a
// locked flight of stairs is how one floor gates the next.
//
//	Atrio de las Siete Coronas  → three erased crowns open the seal
//	Cripta de los Juramentos    → the vanished knights; the tablet dilemma
//	Trono Bajo la Piedra        → Canciller Varren, then the King's fate
//
// The ending is chosen at the throne and recorded in `lostKingEnding`
// (restored | broken | regency). The client shows the campaign epilogue
// from that flag; the player may close the chronicle or keep exploring.

import (
	"fmt"
	"strings"
)

const (
	AtriumID        = "templo-corona-atrio"
	CryptID         = "templo-corona-cripta"
	ThroneID        = "templo-corona-trono"
	templeEntryExit = "f6-to-temple"
	endingReward    = "terra:lost-king:ending:v1"
	kingName        = "el rey Aurelio"
)

var atriumGrid = []string{
	"###################",
	"#.......#.#.......#",
	"#.#####.#.#.#####.#",
	"#.#...#.....#...#.#",
	"#.#.#.#######.#.#.#",
	"#...#.........#...#",
	"###.###.###.###.###",
	"#.....#.#.#.#.....#",
	"#.###.#.#.#.#.###.#",
	"#.#...#.....#...#.#",
	"#.#.#####.#####.#.#",
	"#.................#",
	"###################",
}

var cryptGrid = []string{
	"###################",
	"#.....#.......#...#",
	"#.###.#.#####.#.#.#",
	"#.#.....#...#...#.#",
	"#.#.#####.#.#####.#",
	"#.#.......#.......#",
	"#.#######.#.#####.#",
	"#.........#.#...#.#",
	"#####.#####.#.#.#.#",
	"#.....#.....#.#...#",
	"#.#####.#####.###.#",
	"#.......#.........#",
	"###################",
}

var throneGrid = []string{
	"###################",
	"#########.#########",
	"#######.....#######",
	"######.......######",
	"#####.........#####",
	"####...........####",
	"###.............###",
	"##...#.......#...##",
	"#....#.......#....#",
	"#....##.....##....#",
	"#.......#.#.......#",
	"#.................#",
	"###################",
}

// camel turns "templo-corona-atrio-herald" into "temploCoronaAtrioHerald".
func camel(id string) string {
	parts := strings.Split(id, "-")
	for i := 1; i < len(parts); i++ {
		parts[i] = capFirst(parts[i])
	}
	return strings.Join(parts, "")
}

// checkReachable panics unless every authored entry stands on open floor
// that the party can walk to from where it arrives.
func checkReachable(m *O) *O {
	rows := m.Get("grid").([]string)
	grid := make([][]byte, len(rows))
	for i, r := range rows {
		grid[i] = []byte(r)
	}
	start := m.Obj("partyStart")
	open := reachable(grid, point{start.Int("x"), start.Int("y")})
	for _, group := range []string{"enemies", "interactables", "treasures", "traps", "exits"} {
		for _, raw := range m.Arr(group) {
			e := raw.(*O)
			if !open[point{e.Int("x"), e.Int("y")}] {
				panic(fmt.Sprintf("%s/%s stands on unreachable or solid ground", m.Str("id"), e.Str("id")))
			}
		}
	}
	return m
}

type foeSpec struct {
	key, visual, name string
	pos               point
	hp, retaliation   int
	ai                *O
	flag              string
	gold              int
	effects           A
	journal           *O
	blocking          string
	scale             float64
	// The temple is the last act: its creatures fight at danger level 7
	// unless a spec says otherwise (bosses one step above).
	rating int
}

func authoredFoe(mapID string, f foeSpec) *O {
	effects := A{}
	if f.flag != "" {
		effects = append(effects, obj("type", "set", "key", f.flag, "value", true))
	}
	if f.gold > 0 {
		effects = append(effects, obj("type", "grant-gold", "amount", f.gold))
	}
	effects = append(effects, f.effects...)
	rating := f.rating
	if rating == 0 {
		rating = 7
		if f.flag != "" {
			rating = 8
		}
	}
	toHit, armorClass := combatRating(rating)
	enemy := obj(
		"id", mapID+"-"+f.key, "visualType", f.visual, "name", f.name, "x", f.pos.x, "y", f.pos.y,
		"hpKey", camel(mapID+"-"+f.key)+"Hp", "maxHp", f.hp, "retaliation", f.retaliation,
		"toHit", toHit, "armorClass", armorClass, "agility", speedFor(f.visual, rating),
		"activation", "always", "ai", f.ai,
		"onDefeat", obj("message", "{attacker} derriba a "+f.name+" con {attack}.", "effects", effects),
	)
	if f.flag != "" {
		enemy.Set("defeatedFlag", f.flag)
	}
	if f.journal != nil {
		enemy.Obj("onDefeat").Set("journal", f.journal)
	}
	if f.blocking != "" {
		enemy.Set("blockingMessage", f.blocking)
	}
	if f.scale > 0 {
		enemy.Set("visualScale", f.scale)
	}
	return enemy
}

func acolyteAI() *O {
	return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 3)
}
func knightAI() *O {
	return obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 3)
}
func casterAI() *O { return obj("movement", "hold", "attackReach", 3, "requiresLineOfSight", true) }
func sentryAI() *O {
	return obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 2)
}

func stairs(id string, p point, label, target, entry string, requirements A, locked, message string) *O {
	if locked == "" {
		locked = "La escalera está sellada"
	}
	if message == "" {
		message = label + "."
	}
	if requirements == nil {
		requirements = A{}
	}
	return obj("id", id, "kind", "exit", "visualType", "dungeon-arch", "x", p.x, "y", p.y, "requiresReturn", true,
		"openLabel", label, "lockedLabel", locked, "requirements", requirements,
		"action", obj("effects", A{obj("type", "transition-map", "mapId", target, "entryExitId", entry)}, "message", message))
}

type loreSpec struct {
	id, kind, visual, label, message, locked string
	pos                                      point
	when, effects, requirements              A
	journal                                  *O
}

func lore(l loreSpec) *O {
	kind := l.kind
	if kind == "" {
		kind = "lore"
	}
	effects := l.effects
	if effects == nil {
		effects = A{}
	}
	entry := obj("id", l.id, "kind", kind, "visualType", l.visual, "x", l.pos.x, "y", l.pos.y, "label", l.label)
	if l.when != nil {
		entry.Set("when", l.when)
	}
	if len(l.requirements) > 0 {
		locked := l.locked
		if locked == "" {
			locked = l.label
		}
		entry.Set("requirements", l.requirements).Set("lockedLabel", locked)
	}
	action := obj("effects", effects, "message", l.message)
	if l.journal != nil {
		action.Set("journal", l.journal)
	}
	return entry.Set("action", action)
}

func trap(id string, p point, visual, label string, amount int, message string) *O {
	flag := camel(id) + "Spent"
	return obj("id", id, "kind", "trap", "visualType", visual, "x", p.x, "y", p.y, "label", label,
		"when", A{flagIs(flag, false)},
		"action", obj("effects", A{obj("type", "set", "key", flag, "value", true), obj("type", "damage-party", "amount", amount)},
			"message", message))
}

func chest(id string, p point, visual, flag string, gold int, items A, message string) *O {
	effects := append(A{obj("type", "set", "key", flag, "value", true), obj("type", "grant-gold", "amount", gold)}, items...)
	return obj("id", id, "kind", "pickup", "visualType", visual, "x", p.x, "y", p.y, "label", "Abrir el cofre",
		"when", A{flagIs(flag, false)}, "action", obj("effects", effects, "message", message))
}

func dungeonManifest(id, title, hud string, grid []string, start *O, enemies, interactables, treasures, traps, exits A,
	journalBody, intro, arrival string) *O {
	return checkReachable(obj(
		"id", id, "version", 1, "progressionKey", id+"-v1", "title", title, "hudTitle", hud,
		"areaCode", "F6", "regionKind", "dungeon", "dungeonRole", "main", "layoutMode", "authored",
		"grid", grid, "partyStart", start, "initialFlags", obj(),
		"enemies", enemies, "triggers", A{}, "interactables", interactables, "treasures", treasures, "traps", traps,
		"exits", exits,
		"initialJournal", journal(id+"-arrival", title, journalBody, "F6"),
		"introMessage", intro,
		"arrivalAction", obj("effects", A{}, "message", arrival),
	))
}

type crown struct {
	key, name, description string
	pos                    point
	flag                   string
}

var crowns = []crown{
	{"iron", "Corona de hierro sin nombre", "Una diadema de hierro negro. Alguien limó el nombre del rey que la llevó.", point{4, 3}, "templeCrownIronTaken"},
	{"salt", "Corona de sal sin nombre", "Cristal de sal prensado en forma de corona. El nombre se disolvió hace siglos.", point{14, 3}, "templeCrownSaltTaken"},
	{"ash", "Corona de ceniza sin nombre", "Ceniza apelmazada que conserva la forma de una corona y el calor de un nombre quemado.", point{9, 7}, "templeCrownAshTaken"},
}

func buildAtrium() *O {
	id := AtriumID
	treasures := A{}
	sealRequirements := A{}
	sealEffects := A{}
	for _, c := range crowns {
		item := "temple-crown-" + c.key
		lower := strings.ToLower(c.name)
		treasures = append(treasures, obj(
			"id", item, "kind", "pickup", "visualType", "chain-altar", "x", c.pos.x, "y", c.pos.y,
			"label", "Tomar la "+lower, "when", A{flagIs(c.flag, false)},
			"action", obj("effects", A{obj("type", "set", "key", c.flag, "value", true), grantItem(item, c.name, c.description),
				adv("Reúne las tres coronas sin nombre del Atrio y colócalas en el sello del norte.")},
				"message", "Levantas la "+lower+". Pesa menos de lo que debería: le falta un nombre."),
		))
		sealRequirements = append(sealRequirements, obj("itemId", item, "quantity", 1, "message", "Al sello le faltan coronas. Busca en las alas del Atrio."))
		sealEffects = append(sealEffects, obj("type", "consume-item", "itemId", item, "quantity", 1))
	}
	treasures = append(treasures, chest("temple-atrium-chest", point{17, 1}, "ember-cache", "templeAtriumChestOpened", 90,
		A{grantItem("steel-sword", "Steel sword", "Espada de acero de la guardia del Templo."),
			grantItem("steel-shield", "Steel shield", "Escudo de acero con siete coronas grabadas.")},
		"Ofrendas de peregrinos que nunca volvieron: 90 monedas, una espada y un escudo de acero."))
	sealEffects = append(sealEffects, obj("type", "set", "key", "templeAtriumSealOpen", "value", true),
		xp("terra:temple:atrium-seal:v1", 120), adv("El sello se ha abierto. Baja a la Cripta de los Juramentos."))
	interactables := A{
		lore(loreSpec{id: "temple-atrium-mural", pos: point{8, 9}, visual: "name-plaque", label: "Leer el mural del Primer Pacto",
			message: "El mural cuenta el Primer Pacto: siete reyes juraron ante el Silencio. El Silencio guardaría el reino haciendo olvidar a sus enemigos; a cambio, cada rey pagaría con su nombre al morir. Tres coronas del friso no tienen nombre. Alguien las ha bajado de su sitio.",
			effects: A{obj("type", "set", "key", "templeMuralRead", "value", true)},
			journal: journal("temple-mural", "El Primer Pacto", "El Silencio protege el reino borrando a sus enemigos. El precio son nombres. Tres coronas sin nombre abren el sello del Atrio.", "♛")}),
		lore(loreSpec{id: "temple-atrium-tomb", pos: point{1, 1}, visual: "name-plaque", label: "Leer la lápida sin nombre",
			message: "«Aquí yace un rey. El Silencio se llevó su nombre y el reino le dio las gracias». Debajo, una mano reciente ha añadido con tiza: «V. — que el próximo sea el último»."}),
		lore(loreSpec{id: "temple-atrium-seal", kind: "relic-socket", pos: point{9, 2}, visual: "chain-altar",
			label: "Colocar las tres coronas en el sello", locked: "El sello espera tres coronas sin nombre",
			when: A{flagIs("templeAtriumSealOpen", false)}, requirements: sealRequirements, effects: sealEffects,
			message: "Las tres coronas encajan en el friso y el sello gira con un suspiro de piedra. Al norte, una escalera baja hacia un frío que huele a hierro y a juramentos viejos.",
			journal: journal("temple-seal-open", "Tres coronas, ningún nombre", "El sello del Atrio cede. Debajo esperan la Cripta de los Juramentos y, más abajo, el trono.", "♛")}),
	}
	enemies := A{
		authoredFoe(id, foeSpec{key: "acolyte-west", visual: "silent-acolyte", name: "un acólito del Silencio", pos: point{3, 5}, hp: 16, retaliation: 2, ai: acolyteAI(), gold: 8}),
		authoredFoe(id, foeSpec{key: "acolyte-east", visual: "silent-acolyte", name: "una acólita del Silencio", pos: point{15, 5}, hp: 16, retaliation: 2, ai: acolyteAI(), gold: 8}),
		authoredFoe(id, foeSpec{key: "hound", visual: "bone-hound", name: "un sabueso del templo", pos: point{1, 9}, hp: 15, retaliation: 2, ai: aiFor("bone-hound"), gold: 6}),
		authoredFoe(id, foeSpec{key: "wisp", visual: "ember-wisp", name: "una vela del Silencio", pos: point{17, 9}, hp: 12, retaliation: 3, ai: aiFor("ember-wisp"), gold: 6}),
		authoredFoe(id, foeSpec{key: "herald", visual: "spectral-bishop", name: "el Heraldo del Silencio", pos: point{9, 3}, hp: 36, retaliation: 4, ai: casterAI(),
			flag: "templeHeraldDefeated", gold: 30, scale: 1.12, blocking: "El Heraldo del Silencio no deja pasar a nadie con nombre.",
			journal: journal("temple-herald", "Cae el Heraldo", "El Heraldo guardaba el sello del Atrio. Llevaba la marca de Varren en el sello de su anillo.", "†")}),
	}
	traps := A{
		trap("temple-plate-west", point{7, 5}, "chain-plate", "Losa de las cadenas", 3, "Una losa cede y dos cadenas barren el pasillo. Tres puntos de daño por cabeza."),
		trap("temple-plate-east", point{11, 5}, "chain-plate", "Losa de las cadenas", 3, "Otra losa. Otras dos cadenas. La arquitectura del Templo no cree en las segundas oportunidades."),
	}
	exits := A{
		stairs("temple-to-f6", point{9, 11}, "Salir al Umbral Bajo la Corona (F6)", "terra-f6", templeEntryExit, nil, "",
			"La compañía sube la escalinata y sale a la ceniza de F6."),
		stairs("temple-atrium-down", point{9, 1}, "Bajar a la Cripta de los Juramentos", CryptID, "crypt-up",
			A{obj("key", "templeAtriumSealOpen", "truthy", true, "message", "El sello de las siete coronas sigue cerrado.")},
			"El sello de las siete coronas sigue cerrado", "La compañía baja a la Cripta de los Juramentos."),
	}
	return dungeonManifest(id, "Atrio de las Siete Coronas", "Atrio", atriumGrid, obj("x", 9, "y", 11, "direction", 0),
		enemies, interactables, treasures, traps, exits,
		"Bajo F6 duerme el Templo Bajo la Corona. Siete coronas presiden el friso del Atrio; tres han desaparecido.",
		"Atrio de las Siete Coronas. Siete coronas de piedra presiden el friso; en tres de ellas sólo queda el hueco.",
		"Atrio de las Siete Coronas. Al norte, un sello circular con tres huecos. A los lados, pasos de sandalias en el polvo.")
}

func buildCrypt() *O {
	id := CryptID
	interactables := A{
		lore(loreSpec{id: "crypt-edric-ghost", pos: point{9, 3}, visual: "oathbound-knight", label: "Hablar con el espectro de Sir Edric",
			message: "Un caballero translúcido se arrodilla sin poder evitarlo: «Soy Edric, de la escolta de la Dama. Varren nos trajo aquí y nos hizo jurar ante su corona hueca. Ahora servimos a quien la lleve. La tablilla del Primer Pacto puede romper nuestro juramento… o devolvérselo al Rey. No ambas cosas. Decidid vosotros: nosotros ya no podemos».",
			when:    A{flagIs("templeKnightsFreed", false)},
			effects: A{obj("type", "set", "key", "templeEdricMet", "value", true), adv("Decide qué hacer con la tablilla del juramento y consigue la llave del Trono.")},
			journal: journal("crypt-edric", "Los caballeros juramentados", "Los caballeros de la Dama están atados a la corona hueca de Varren. La tablilla del Pacto puede liberarlos o devolverle el juramento al Rey, pero no ambas cosas.", "♛")}),
		lore(loreSpec{id: "crypt-edric-rest", pos: point{9, 3}, visual: "oathbound-knight", label: "Despedirse de Sir Edric",
			message: "El espectro de Edric sonríe por primera vez: «Decidle a la Dama que volvimos. Aunque fuera así».",
			when:    A{flagIs("templeKnightsFreed", true)}}),
		lore(loreSpec{id: "crypt-oath-altar", pos: point{11, 3}, visual: "shrine", label: "Leer la tablilla ante el altar y liberar a los caballeros",
			locked:       "El altar de los juramentos espera la tablilla",
			when:         A{flagIs("templeKnightsFreed", false)},
			requirements: A{obj("itemId", "oath-tablet", "quantity", 1, "message", "Sin la tablilla del juramento, el altar es sólo piedra.")},
			effects: A{obj("type", "claim-reward", "rewardId", "terra:temple:knights-freed:v1",
				"requirements", A{obj("itemId", "oath-tablet", "quantity", 1)},
				"effects", A{obj("type", "consume-item", "itemId", "oath-tablet", "quantity", 1),
					obj("type", "set", "key", "templeKnightsFreed", "value", true),
					// Freed knights never stand guard at the throne.
					obj("type", "set", "key", "templeKnightHadricDown", "value", true),
					obj("type", "set", "key", "templeKnightYsoldeDown", "value", true),
					xp("terra:temple:knights-freed:v1", 150),
					adv("Los caballeros descansan. Consigue la llave del Trono y baja a enfrentarte a Varren.")}),
				obj("type", "heal-party", "amount", 20)},
			message: "Lees la tablilla en voz alta. Las palabras del Primer Pacto suenan distintas aquí abajo: no como una promesa, sino como una llave. Uno a uno, los caballeros se ponen en pie, se quitan el yelmo y se desvanecen. La tablilla se agrieta y se convierte en polvo.",
			journal: journal("crypt-knights-freed", "Los que volvieron", "La compañía usó la tablilla para liberar a los caballeros de la Dama. Ya no guardarán a Varren; tampoco queda tablilla para el Rey.", "♛")}),
		lore(loreSpec{id: "crypt-edric-diary", pos: point{3, 3}, visual: "name-plaque", label: "Leer el diario de Sir Edric",
			message: "«Día 3. El Canciller nos esperaba en el vado con vino y una corona que no pesaba. Día 4. No recuerdo el nombre de mi madre. Día 5. Juré algo. No sé qué. Día ¿?. Si alguien lee esto: no le dejéis sentarse en el trono»."}),
		lore(loreSpec{id: "crypt-font", pos: point{1, 11}, visual: "shrine", label: "Beber de la Pila de los Juramentos",
			when: A{flagIs("templeCryptFontUsed", false)},
			effects: A{obj("type", "set", "key", "templeCryptFontUsed", "value", true), obj("type", "heal-party", "amount", 30),
				obj("type", "restore-spell-points"), obj("type", "refill-class-abilities")},
			message: "El agua de la pila está quieta como un espejo. Al beber, la compañía recuerda con nitidez sus propios nombres. Heridas cerradas, puntos de hechizo recuperados."}),
	}
	treasures := A{chest("crypt-chest", point{17, 1}, "ember-cache", "templeCryptChestOpened", 120,
		A{grantItem("steel-plate", "Steel plate", "Armadura de placas de un caballero que ya no la necesita."),
			grantItem("silver-staff", "Silver staff", "Bastón de plata de un capellán de la escolta.")},
		"El ajuar de la escolta: 120 monedas, una armadura de placas de acero y un bastón de plata.")}
	enemies := A{
		authoredFoe(id, foeSpec{key: "spider", visual: "crypt-spider", name: "una araña de osario", pos: point{5, 5}, hp: 16, retaliation: 2, ai: aiFor("crypt-spider"), gold: 8}),
		authoredFoe(id, foeSpec{key: "hound", visual: "bone-hound", name: "un lobo de hueso", pos: point{17, 7}, hp: 17, retaliation: 2, ai: aiFor("bone-hound"), gold: 8}),
		authoredFoe(id, foeSpec{key: "acolyte", visual: "silent-acolyte", name: "un acólito del Silencio", pos: point{13, 9}, hp: 18, retaliation: 3, ai: acolyteAI(), gold: 10}),
		authoredFoe(id, foeSpec{key: "wisp", visual: "ember-wisp", name: "una vela del Silencio", pos: point{5, 9}, hp: 13, retaliation: 3, ai: aiFor("ember-wisp"), gold: 8}),
		authoredFoe(id, foeSpec{key: "jailer", visual: "gate-jailer", name: "el Carcelero del Silencio", pos: point{10, 11}, hp: 42, retaliation: 5, ai: sentryAI(),
			flag: "templeJailerDefeated", gold: 40, scale: 1.14,
			effects: A{grantItem("throne-key", "Llave del Trono", "Una llave de hierro frío que abre la escalera al Trono Bajo la Piedra."),
				adv("Tienes la llave del Trono. Baja y detén al Canciller Varren.")},
			blocking: "El Carcelero del Silencio cierra el paso con su cuerpo de hierro.",
			journal:  journal("crypt-jailer", "Cae el Carcelero", "Del cinturón del Carcelero cuelga la Llave del Trono.", "†")}),
		// Modest optional patrols in empty wings; never duplicate the Jailer or its key.
		authoredFoe(id, foeSpec{key: "spider-west", visual: "crypt-spider", name: "una araña de nicho", pos: point{3, 7}, hp: 14, retaliation: 2, ai: aiFor("crypt-spider"), gold: 4}).With("optional", true),
		authoredFoe(id, foeSpec{key: "acolyte-east", visual: "silent-acolyte", name: "un acólito errante", pos: point{13, 5}, hp: 16, retaliation: 3, ai: acolyteAI(), gold: 5}).With("optional", true),
		authoredFoe(id, foeSpec{key: "hound-south", visual: "bone-hound", name: "un lobo de cripta", pos: point{7, 9}, hp: 15, retaliation: 2, ai: aiFor("bone-hound"), gold: 4}).With("optional", true),
	}
	traps := A{
		trap("crypt-plate-centre", point{9, 7}, "chain-plate", "Losa de los juramentos", 4, "Una losa grabada con un juramento se hunde. Las cadenas del techo caen sobre la compañía: cuatro puntos de daño."),
		trap("crypt-vent-south", point{14, 11}, "slag-vent", "Respiradero de ceniza", 3, "El suelo exhala ceniza ardiente. Tres puntos de daño y una lección sobre mirar dónde se pisa."),
	}
	exits := A{
		stairs("crypt-up", point{1, 1}, "Subir al Atrio de las Siete Coronas", AtriumID, "temple-atrium-down", nil, "", ""),
		stairs("crypt-down", point{9, 11}, "Bajar al Trono Bajo la Piedra", ThroneID, "throne-up",
			A{obj("itemId", "throne-key", "quantity", 1, "message", "La reja del Trono necesita la llave del Carcelero.")},
			"Reja del Trono · cerrada con llave", "La Llave del Trono gira. La compañía baja hacia una luz que no viene de ninguna antorcha."),
	}
	return dungeonManifest(id, "Cripta de los Juramentos", "Cripta", cryptGrid, obj("x", 1, "y", 1, "direction", 2),
		enemies, interactables, treasures, traps, exits,
		"Nichos llenos de yelmos vacíos. En el centro, un altar donde se juraba en nombre del Rey.",
		"Cripta de los Juramentos. Yelmos alineados en los nichos, todos mirando hacia el mismo altar.",
		"Cripta de los Juramentos. Entre los nichos, siluetas de caballeros de rodillas. No respiran, pero escuchan.")
}

func endingEffects(ending string, gold, amount int, objective string) A {
	return A{obj("type", "claim-reward", "rewardId", endingReward,
		"requirements", A{flagIs("lostKingEnding", false), flagIs("varrenDefeated", true)},
		"effects", A{obj("type", "set", "key", "lostKingEnding", "value", ending),
			obj("type", "grant-gold", "amount", gold),
			xp("terra:lost-king:ending:"+ending+":v1", amount),
			mainQuest().With("type", "complete-quest").reorderFirst("type").With("objective", objective)})}
}

func buildThrone() *O {
	id := ThroneID
	afterVarren := func() A { return A{flagIs("varrenDefeated", true), flagIs("lostKingEnding", false)} }
	king := capFirst(kingName)
	interactables := A{
		lore(loreSpec{id: "throne-king-stone", pos: point{9, 1}, visual: "stone-king", label: "Sacar al Rey de la piedra, sin juramento",
			when:    afterVarren(),
			effects: endingEffects("regency", 250, 300, "El Rey vive. La Dama gobernará como regente."),
			message: "Rompéis la piedra con las manos y con lo que tenéis. " + king + " sale del trono como sale un hombre de un pozo: vivo, débil y sin corona. «No volveré a jurar», dice. «Que el reino lo gobierne quien recuerde los nombres». El Silencio se queda sin rey y sin dueño.",
			journal: journal("lost-king-ending-regency", "Un rey sin juramento", "La compañía liberó al Rey sin renovar el Pacto. Aurelio abdica; la Dama gobernará como regente.", "♛")}),
		lore(loreSpec{id: "throne-oath-restore", pos: point{8, 2}, visual: "shrine", label: "Devolver el juramento al Rey con la tablilla",
			locked:       "Sin la tablilla no hay juramento que devolver",
			when:         afterVarren(),
			requirements: A{obj("itemId", "oath-tablet", "quantity", 1, "message", "Sin la tablilla no hay juramento que devolver.")},
			effects:      append(A{obj("type", "consume-item", "itemId", "oath-tablet", "quantity", 1)}, endingEffects("restored", 300, 350, "El Rey ha vuelto con el juramento intacto.")...),
			message:      "Pones la tablilla en las manos de piedra de " + kingName + ". La lee sin abrir los ojos. La piedra se agrieta desde dentro y el Rey se levanta con el juramento intacto: «El Pacto es mío otra vez. Nadie volverá a jurar en mi nombre». El Silencio se arrodilla como un perro que reconoce a su amo.",
			journal:      journal("lost-king-ending-restored", "El Rey vuelve", "La compañía devolvió el juramento del Primer Pacto al rey Aurelio. El Silencio vuelve a tener amo.", "♛")}),
		lore(loreSpec{id: "throne-oath-break", pos: point{10, 2}, visual: "chain-altar", label: "Romper la tablilla sobre el trono y acabar con el Pacto",
			locked:       "Necesitas la tablilla para romper el Pacto",
			when:         afterVarren(),
			requirements: A{obj("itemId", "oath-tablet", "quantity", 1, "message", "Necesitas la tablilla para romper el Pacto.")},
			effects:      append(A{obj("type", "consume-item", "itemId", "oath-tablet", "quantity", 1)}, endingEffects("broken", 200, 400, "El Pacto está roto. Los nombres borrados han vuelto.")...),
			message:      "Rompes la tablilla contra el brazo del trono. El Pacto se deshace con un ruido de mil puertas abriéndose a la vez. Por todo Terra, los nombres que el Silencio se había llevado vuelven a sus dueños. " + king + " sale de la piedra convertido en un hombre corriente, y por primera vez en su vida parece aliviado.",
			journal:      journal("lost-king-ending-broken", "Sin corona", "La compañía rompió el Primer Pacto. El Silencio ha soltado todos los nombres; el reino ya no tiene quien lo haga olvidar.", "♛")}),
		lore(loreSpec{id: "throne-varren-before", pos: point{9, 1}, visual: "stone-king", label: "Mirar el trono",
			when:    A{flagIs("varrenDefeated", false)},
			message: "En el trono de piedra hay un hombre de piedra: " + kingName + ". Delante, de pie, el Canciller Varren se ajusta una corona que no pesa nada."}),
		lore(loreSpec{id: "throne-after", pos: point{9, 1}, visual: "empty-throne", label: "Mirar el trono vacío",
			when:    A{flagIs("lostKingEnding", true)},
			message: "El trono está vacío. En el suelo, la corona hueca de Varren ya no brilla. Esta historia ha terminado; Terra sigue ahí arriba."}),
	}
	knight := func(key, name, flag string, p point) *O {
		k := authoredFoe(id, foeSpec{key: key, visual: "oathbound-knight", name: name, pos: p, hp: 30, retaliation: 4, ai: knightAI(),
			flag: flag, scale: 1.04})
		// A freed knight never fights; a defeated one has its oath broken too.
		k.Obj("onDefeat").Set("message", "{attacker} rinde a "+name+" con {attack}. El juramento se rompe con su armadura.")
		return k
	}
	enemies := A{
		authoredFoe(id, foeSpec{key: "varren", visual: "chancellor-varren", name: "el Canciller Varren", pos: point{9, 4}, hp: 70, retaliation: 6,
			ai: obj("movement", "hold", "attackReach", 3, "requiresLineOfSight", true), flag: "varrenDefeated", gold: 150, scale: 1.1,
			effects: A{grantItem("hollow-crown", "Corona hueca", "La corona sin peso con la que Varren quiso jurar en nombre del Rey. Ya no sirve para nada, y eso es lo mejor que se puede decir de ella."),
				adv("Varren ha caído. Decide ante el trono el destino del Rey.")},
			blocking: "Varren alza la corona hueca: «Un paso más y olvidaréis vuestros nombres».",
			journal:  journal("throne-varren", "Cae el Canciller", "Varren cae con la corona hueca en la cabeza. Al tocar el suelo, la corona se apaga. Queda decidir qué hacer con el Rey.", "†")}),
		knight("knight-west", "Sir Hadric, juramentado", "templeKnightHadricDown", point{6, 7}),
		knight("knight-east", "Dama Ysolde, juramentada", "templeKnightYsoldeDown", point{12, 7}),
		authoredFoe(id, foeSpec{key: "acolyte-west", visual: "silent-acolyte", name: "un acólito del Silencio", pos: point{3, 9}, hp: 18, retaliation: 3, ai: acolyteAI(), gold: 10}),
		authoredFoe(id, foeSpec{key: "acolyte-east", visual: "silent-acolyte", name: "una acólita del Silencio", pos: point{15, 9}, hp: 18, retaliation: 3, ai: acolyteAI(), gold: 10}),
	}
	exits := A{stairs("throne-up", point{9, 11}, "Subir a la Cripta de los Juramentos", CryptID, "crypt-down", nil, "", "")}
	return dungeonManifest(id, "Trono Bajo la Piedra", "Trono", throneGrid, obj("x", 9, "y", 11, "direction", 0),
		enemies, interactables, A{}, A{}, exits,
		"Una nave abovedada bajo la montaña. Al fondo, un trono de piedra con un hombre de piedra sentado en él.",
		"Trono Bajo la Piedra. Al fondo, un trono. En el trono, un rey de piedra. Delante, un canciller con corona.",
		"Trono Bajo la Piedra. Varren no se vuelve: «Llegáis tarde. Dentro de un momento el Rey seré yo, y nadie recordará que hubo otro».")
}

func templeMaps() map[string]*O {
	return map[string]*O{AtriumID: buildAtrium(), CryptID: buildCrypt(), ThroneID: buildThrone()}
}

// damaPeople is the Dama's audience, her wait, and her words once the story
// has an ending.
func damaPeople() []*O {
	x, y, visual := 11, 10, "building-hall"
	people := []*O{
		step("dama-audience", x, y, visual, "Audiencia con la Dama · 100 oro",
			when(flagIs("vigiliaOsricReported", true), flagIs("lostKingFinalActOpen", false)),
			A{obj("type", "claim-reward", "rewardId", "terra:dama:v1", "requirements", A{flagIs("vigiliaOsricReported", true)},
				"effects", A{obj("type", "set", "key", "lostKingFinalActOpen", "value", true), obj("type", "grant-gold", "amount", 100),
					xp("terra:dama:v1", 200),
					adv("Entra en el Templo Bajo la Corona (F6), abre el sello de las siete coronas y detén al Canciller Varren.")})},
			"La Dama recibe la tablilla sin testigos: «El Canciller Varren fundió una corona hueca para jurar en lugar del Rey. Anoche huyó al Templo Bajo la Corona, en F6, con la mitad de mis guardias. El Rey sigue vivo bajo la piedra. Guardad la tablilla: allí abajo la vais a necesitar, y sólo vosotros sabréis para qué»",
			journal("lost-king-dama", "La Dama", "El Rey vive bajo el Templo Bajo la Corona (F6). El Canciller Varren es el traidor y ha huido allí. La tablilla del juramento hará falta abajo.", "♛"),
			"", nil, ""),
		step("dama-waiting", x, y, visual, "Hablar con la Dama",
			when(flagIs("lostKingFinalActOpen", true), flagIs("lostKingEnding", false)), A{},
			"La Dama no se ha movido de la ventana que mira al sureste: «F6. El Umbral Bajo la Corona. Volved con el Rey, o volved con la verdad».",
			nil, "", nil, ""),
	}
	after := []struct{ ending, line string }{
		{"restored", "La Dama sonríe con cansancio mientras el Rey firma decretos a su lado: «Ha vuelto. Con su juramento y con su Silencio. Rezad para que esta vez lo use mejor»."},
		{"broken", "La Dama tiene una lista larguísima sobre la mesa: «Son nombres. Gente que había desaparecido y hoy ha llamado a su puerta. No sé gobernar un reino sin Silencio, pero voy a aprender»."},
		{"regency", "La Dama lleva el sello de la regencia como quien lleva un peso ajeno: «El Rey descansa. Yo gobierno. Y vosotros, si queréis, tenéis aquí una casa»."},
	}
	for _, a := range after {
		people = append(people, step("dama-after-"+a.ending, x, y, visual, "Hablar con la Dama",
			when(obj("key", "lostKingEnding", "equals", a.ending)), A{}, a.line, nil, "", nil, ""))
	}
	return people
}
