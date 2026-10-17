package main

// Terra, Might and Magic III style: outdoor areas A1..F6 joined edge to
// edge, with towns and dungeons opening from inside them. The tables below
// are the design; the functions turn them into runtime manifests.

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	W, H   = 21, 15
	CX, CY = 10, 7
	COLS   = "ABCDEF"
)

type point struct{ x, y int }

var gates = map[string]point{"N": {10, 1}, "S": {10, 13}, "W": {1, 7}, "E": {19, 7}}
var gateOrder = []string{"N", "S", "W", "E"}
var stepDir = map[string]point{"N": {0, -1}, "S": {0, 1}, "W": {-1, 0}, "E": {1, 0}}
var stepOrder = []string{"N", "S", "W", "E"}

var existing = map[string]string{"C3": "banner-road-first-book", "D3": "rookwood-first-book"}
var existingOrder = []string{"C3", "D3"}

func mainQuest() *O {
	return obj("questId", "lost-king", "title", "El rey desaparecido",
		"description", "La Dama busca a sus caballeros desaparecidos.", "order", 1)
}

type area struct{ name, biome, flavour string }

// Area codes in the order the design table lists them.
var areaOrder = []string{
	"A1", "B1", "C1", "D1", "E1", "F1", "A2", "B2", "C2", "D2", "E2", "F2", "A3", "B3", "E3", "F3",
	"A4", "B4", "C4", "D4", "E4", "F4", "A5", "B5", "C5", "D5", "E5", "F5", "A6", "B6", "C6", "D6", "E6", "F6",
}

var areas = map[string]area{
	"A1": {"Glaciar del Cuervo", "snow", "Hielo azul hasta donde alcanza la vista. Un cuervo te sigue de roca en roca."},
	"B1": {"Paso de los Juramentos", "snow", "Un desfiladero entre picos. Los viajeros dejan aquí piedras con su nombre."},
	"C1": {"Llanura de la Vigilia", "snow", "Al fondo, las almenas de Vigilia del Norte humean contra el cielo blanco."},
	"D1": {"Túmulos del Pacto", "snow", "Siete túmulos en círculo. El viento no entra en el del centro."},
	"E1": {"Bosque de Escarcha", "forest", "Pinos cargados de hielo crujen como huesos viejos."},
	"F1": {"Faro Helado", "coast", "Un faro sin farero guarda una costa que ya nadie navega."},
	"A2": {"Acantilados de Hollín", "coast", "El mar golpea abajo. La roca está negra de hollín de algún incendio antiguo."},
	"B2": {"Brezal de los Lobos", "hills", "Brezo hasta la cintura y aullidos que nunca suenan cerca."},
	"C2": {"Colinas de la Corona", "hills", "Desde aquí se ven las torres de Swordhaven y, al norte, la nieve."},
	"D2": {"Viñedos del Rey", "plains", "Vides sin vendimiar. Las uvas se pudren desde que el Rey desapareció."},
	"E2": {"Estribaciones de Escoria", "hills", "La tierra se vuelve gris y huele a fragua."},
	"F2": {"Ladera de Ascuafría", "ash", "Chimeneas de Ascuafría en lo alto; ceniza tibia bajo los pies."},
	"A3": {"Bahía de Hollín", "coast", "Barcas varadas y redes al sol. Puerto de Hollín está a un paso."},
	"B3": {"Calzada del Oeste", "plains", "Una calzada real con mojones rotos a martillazos."},
	"E3": {"Bocamina de Escoria", "ash", "Raíles oxidados se pierden en la boca de una mina."},
	"F3": {"Crestas Volcánicas", "ash", "Lava vieja convertida en piedra. Algo brilla en las grietas."},
	"A4": {"Calas de los Contrabandistas", "coast", "Calas escondidas, cuerdas en la roca y una cueva que respira."},
	"B4": {"Granjas del Trigo", "plains", "Campos de trigo y graneros vacíos. Los granjeros hablan bajo."},
	"C4": {"Encrucijada del Ahorcado", "plains", "Un cruce de caminos con una horca sin ahorcado. Alguien lo descolgó."},
	"D4": {"Lindes de las Marismas", "marsh", "La tierra cede. El aire sabe a sal."},
	"E4": {"Bosque Ceniciento", "forest", "Árboles grises que no dan sombra."},
	"F4": {"Fundición en Ruinas", "ash", "Un horno del tamaño de una iglesia, frío desde hace un siglo."},
	"A5": {"Arrecifes del Naufragio", "coast", "Costillares de barcos asoman entre las rocas."},
	"B5": {"Molinos del Oeste", "plains", "Molinos que giran sin viento. Nadie quiere saber por qué."},
	"C5": {"Orillas de Vado de Sal", "marsh", "Pasarelas de madera sobre el agua salobre; Vado de Sal al alcance."},
	"D5": {"Marismas de Sal", "marsh", "Cañas, lodo y voces que no son de nadie."},
	"E5": {"Ciénaga Negra", "marsh", "Agua negra y quieta. Una choza sobre pilotes, con luz verde."},
	"F5": {"Desierto de Ceniza", "ash", "Dunas grises y el esqueleto de un dragón que nadie se atreve a medir."},
	"A6": {"Isla del Faro Roto", "coast", "Una isla unida a tierra por una lengua de arena que la marea cubre."},
	"B6": {"Dunas Costeras", "coast", "Dunas blancas. El viento borra tus huellas detrás de ti."},
	"C6": {"Salinas Hundidas", "marsh", "Eras de sal abandonadas. Una compuerta lleva bajo tierra."},
	"D6": {"Puertas de Bronce", "plains", "La gran calzada termina en las murallas doradas de la Corte de Bronce."},
	"E6": {"Ruinas del Obispo", "hills", "Una abadía derrumbada. Las campanas están enterradas, no rotas."},
	"F6": {"Umbral Bajo la Corona", "ash", "Una escalinata desciende a una puerta sellada con siete coronas."},
}

type town struct{ id, name, flavour string }

var townOrder = []string{"A3", "C5", "F2", "C1", "D6"}
var towns = map[string]town{
	"A3": {"puerto-de-hollin", "Puerto de Hollín", "Gaviotas, brea y un campanario que nadie toca desde hace semanas."},
	"C5": {"vado-de-sal", "Vado de Sal", "Casas sobre pilotes, puentes de cuerda y la sal en cada esquina."},
	"F2": {"ascuafria", "Ascuafría", "Martillos en cada calle; el aire tiembla de calor."},
	"C1": {"vigilia-del-norte", "Vigilia del Norte", "Un burgo de piedra y nieve, con más libros que vecinos."},
	"D6": {"corte-de-bronce", "Corte de Bronce", "Cúpulas de bronce, guardias de gala y silencio de luto."},
}

type boss struct {
	visual, name string
	hp           int
	scale        float64 // 0 = the species' usual size
}

type dungeon struct {
	id, name, hud, theme string
	boss                 boss
}

var dungeonOrder = []string{"C6", "A4", "E3", "D1", "E5"}
var dungeons = map[string]dungeon{
	"C6": {"salinas-hundidas", "Salinas Hundidas", "Salinas", "marsh", boss{"drowned", "el Capitán Ahogado", 16, 0}},
	"A4": {"cueva-contrabandistas", "Cueva de los Contrabandistas", "Cueva", "coast", boss{"bandit-captain", "Mano Negra, jefa de contrabandistas", 18, 0}},
	"E3": {"minas-de-escoria", "Minas de Escoria", "Minas", "ash", boss{"gate-jailer", "el Capataz de Escoria", 22, 0}},
	"D1": {"tumulos-primer-pacto", "Túmulos del Primer Pacto", "Túmulos", "snow", boss{"spectral-bishop", "el Guardián del Túmulo", 24, 0}},
	"E5": {"cienaga-negra", "Choza de la Ciénaga Negra", "Ciénaga", "marsh", boss{"mire-witch", "la Bruja del Cieno", 20, 0}},
}

var signposts = map[string]string{
	"C4": "Cartel: al sur, Vado de Sal (C5). Al norte, Swordhaven por el Camino (C3).",
	"B3": "Cartel: al oeste, Puerto de Hollín (A3). Al este, el Camino de los Estandartes (C3).",
	"D2": "Cartel: al este, Ascuafría (F2), por las estribaciones. Al norte, la Vigilia (C1).",
	"C2": "Cartel: al norte, Vigilia del Norte (C1). Al sur, Swordhaven.",
	"D5": "Cartel: al este, la Ciénaga Negra (E5). No vayas de noche. Ni de día.",
	"C5": "Cartel: Vado de Sal, aquí mismo. Al sur, las Salinas Hundidas (C6).",
	"D6": "Cartel: Corte de Bronce. Los peregrinos esperan turno a la puerta.",
	"E2": "Cartel: Ascuafría (F2) al este. Minas de Escoria (E3) al sur.",
	"A2": "Cartel: Puerto de Hollín (A3) al sur, siguiendo el acantilado.",
	"F5": "Cartel borrado por la ceniza. Sólo se lee «...bajo la corona».",
}

var shrines = map[string]string{
	"B2": "Fuente de los Lobos", "E1": "Fuente de Escarcha", "B5": "Fuente del Molino",
	"F3": "Fuente de Lava Dormida", "A6": "Fuente del Faro", "E6": "Pila del Obispo",
}

type hermit struct{ id, name, line string }

var hermits = map[string]hermit{
	"B4": {"b4-farmer", "la granjera Tesa", "«Desde que el Rey falta, los recaudadores vienen dos veces. Uno de ellos llevaba un anillo de Ascuafría.»"},
	"E4": {"e4-charcoal", "el carbonero Bruno", "«En las Minas de Escoria trabajan de noche. ¿Quién trabaja de noche en una mina?»"},
	"A5": {"a5-wrecker", "el raquero Ismael", "«Los contrabandistas de las calas tienen campana nueva. Una campana no se roba sola.»"},
	"D4": {"d4-eel", "la anguilera Marta", "«En las Salinas Hundidas se oyen gritos de hombres de armas. Llevan semanas gritando.»"},
	"B1": {"b1-pilgrim", "el peregrino Anselmo", "«Los Túmulos del Pacto se abrieron la misma noche que el Rey desapareció.»"},
}

type species struct{ visual, name string }

var biomeFoes = map[string][]species{
	"plains": {{"road-bandit", "salteador"}, {"ash-goblin", "goblin"}, {"sewer-rat", "rata gigante"}, {"skeleton", "ahorcado del camino"}},
	"forest": {{"bone-hound", "sabueso de hueso"}, {"weaver-spider", "araña tejedora"}, {"ash-goblin", "goblin del bosque"}, {"troll", "trol del bosque"}},
	"hills":  {{"ash-goblin", "goblin de las colinas"}, {"road-bandit", "bandolero"}, {"bone-hound", "lobo de hueso"}, {"troll", "trol de las colinas"}, {"harpy", "arpía del brezal"}},
	"marsh":  {{"salt-crab", "cangrejo de salitre"}, {"drowned", "ahogado"}, {"sewer-rat", "rata de marisma"}, {"bog-toad", "sapo de la ciénaga"}},
	"coast":  {{"salt-crab", "cangrejo de roca"}, {"drowned", "náufrago ahogado"}, {"road-bandit", "pirata"}, {"harpy", "arpía del acantilado"}},
	"snow":   {{"bone-hound", "lobo de escarcha"}, {"scavenger-knight", "caballero helado"}, {"ice-wraith", "espectro de escarcha"}, {"skeleton", "guerrero congelado"}},
	"ash":    {{"ash-goblin", "goblin de ceniza"}, {"ember-wisp", "lumbre de ceniza"}, {"gate-jailer", "guardián de escoria"}, {"ash-salamander", "salamandra de ceniza"}},
}

// Species keep their tactical identity (chroniclesBestiaryBehavior.test.js).
// The drowned never stop walking; sentries hold until the company is close.
func aiFor(visual string) *O {
	switch visual {
	case "ash-goblin":
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 2)
	case "bone-hound":
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 4)
	case "crypt-spider", "weaver-spider":
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "knight-chase", "engageRange", 3)
	case "ember-wisp":
		return obj("movement", "hold", "attackReach", 2, "requiresLineOfSight", true)
	case "spectral-bishop":
		return obj("movement", "hold", "attackReach", 3, "requiresLineOfSight", true)
	case "salt-crab":
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "knight-chase", "engageRange", 2)
	case "drowned":
		return obj("movement", "cardinal-chase", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 3)
	case "sewer-rat":
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 3)
	// Terra's wider bestiary: each species fights its own way.
	case "skeleton": // a sentry that marches once it sees you
		return obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 3)
	case "harpy": // dives in from odd angles
		return obj("movement", "cardinal-roam", "attackReach", 1, "engagedMovement", "knight-chase", "engageRange", 4)
	case "troll": // slow brute: waits, then never lets go
		return obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 1)
	case "ice-wraith": // drifts in and claws from two cells away
		return obj("movement", "cardinal-roam", "attackReach", 2, "engagedMovement", "cardinal-chase", "engageRange", 3, "requiresLineOfSight", true)
	case "ash-salamander": // spits fire from where it basks
		return obj("movement", "hold", "attackReach", 2, "requiresLineOfSight", true)
	case "bog-toad": // a tongue that reaches two cells
		return obj("movement", "hold", "attackReach", 2, "engagedMovement", "cardinal-chase", "engageRange", 1)
	}
	return obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 2)
}

// signature is how an enemy moves and strikes, as the bestiary test reads it.
func signature(ai *O) string {
	engaged := ai.Str("engagedMovement")
	if engaged == "" {
		engaged = "-"
	}
	return fmt.Sprintf("%s>%s@%d", ai.Str("movement"), engaged, ai.Int("attackReach"))
}

var density = map[string]float64{"plains": 0.12, "forest": 0.46, "hills": 0.3, "marsh": 0.32, "coast": 0.24, "snow": 0.22, "ash": 0.28}

// ─── helpers ───────────────────────────────────────────────────────────────

func codeXY(code string) (int, int) {
	return strings.IndexByte(COLS, code[0]), int(code[1]-'0') - 1
}

func xyCode(x, y int) string {
	if x >= 0 && x < 6 && y >= 0 && y < 6 {
		return fmt.Sprintf("%c%d", COLS[x], y+1)
	}
	return ""
}

func neighbour(code, side string) string {
	x, y := codeXY(code)
	d := stepDir[side]
	return xyCode(x+d.x, y+d.y)
}

func mapID(code string) string {
	if id, ok := existing[code]; ok {
		return id
	}
	return "terra-" + strings.ToLower(code)
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func danger(code string) int {
	x, y := codeXY(code)
	return abs(x-2) + abs(y-2)
}

func gateExitID(src, dst string) string {
	if src == "C3" && dst == "D3" {
		return "to-banner-road-rookwood"
	}
	if src == "D3" && dst == "C3" {
		return "to-rookwood-banner-road"
	}
	return strings.ToLower(src) + "-to-" + strings.ToLower(dst)
}

func hash2(x, y, salt int) float64 {
	n := (uint64(x)*374761393 + uint64(y)*668265263 + uint64(salt)*2147483647) & 0xFFFFFFFF
	n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
	return float64((n^(n>>16))&0xFFFF) / 0xFFFF
}

func saltOf(text string) int {
	value := 7
	for _, ch := range text {
		value = (value*131 + int(ch)) & 0xFFFF
	}
	return value
}

func tier(level int) string {
	switch {
	case level <= 1:
		return "bronze"
	case level <= 3:
		return "iron"
	case level <= 5:
		return "silver"
	}
	return "steel"
}

func adv(objective string) *O { return mainQuest().With("type", "advance-quest").reorderFirst("type").With("objective", objective) }

// reorderFirst moves key k to the front (to mirror {"type": ..., **MAIN}).
func (o *O) reorderFirst(k string) *O {
	for i, e := range o.kv {
		if e.k == k {
			rest := append(append([]kv{}, o.kv[:i]...), o.kv[i+1:]...)
			o.kv = append([]kv{e}, rest...)
			break
		}
	}
	return o
}

func xp(award string, amount int) *O { return obj("type", "award-xp", "awardId", award, "amount", amount) }

func capFirst(s string) string {
	r, size := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[size:]
}

func camelFlag(text string) string { return strings.ReplaceAll(text, "-", "_") }

func reachable(grid [][]byte, start point) map[point]bool {
	seen := map[point]bool{start: true}
	queue := []point{start}
	for len(queue) > 0 {
		p := queue[0]
		queue = queue[1:]
		for _, s := range stepOrder {
			d := stepDir[s]
			n := point{p.x + d.x, p.y + d.y}
			if n.x >= 0 && n.x < len(grid[0]) && n.y >= 0 && n.y < len(grid) && grid[n.y][n.x] == '.' && !seen[n] {
				seen[n] = true
				queue = append(queue, n)
			}
		}
	}
	return seen
}

func carveLine(grid [][]byte, a, b point) {
	for x := min(a.x, b.x); x <= max(a.x, b.x); x++ {
		grid[a.y][x] = '.'
	}
	for y := min(a.y, b.y); y <= max(a.y, b.y); y++ {
		grid[y][b.x] = '.'
	}
}

// ─── outdoor areas ─────────────────────────────────────────────────────────

var slots = []point{{5, 4}, {15, 4}, {5, 10}, {15, 10}, {4, 7}, {16, 7}, {10, 4}, {10, 10}}
var foeSlots = []point{{7, 3}, {13, 11}, {3, 11}, {17, 3}, {13, 3}, {7, 11}}

func areaGrid(code, biome string, keep []point) []string {
	salt := saltOf(code)
	grid := make([][]byte, H)
	for y := range grid {
		grid[y] = make([]byte, W)
		for x := range grid[y] {
			if x == 0 || x == W-1 || y == 0 || y == H-1 {
				grid[y][x] = '#'
			} else {
				grid[y][x] = '.'
			}
		}
	}
	d := density[biome]
	for y := 1; y < H-1; y++ {
		for x := 1; x < W-1; x++ {
			cell := hash2(x/2, y/2, salt)*0.6 + hash2(x, y, salt+1)*0.4
			if cell < d {
				grid[y][x] = '#'
			}
		}
	}
	for _, side := range gateOrder {
		carveLine(grid, gates[side], point{CX, CY})
	}
	for _, p := range keep {
		if abs(p.x-CX) > 0 {
			carveLine(grid, p, point{CX, p.y})
		} else {
			carveLine(grid, p, point{p.x, CY})
		}
		carveLine(grid, point{CX, p.y}, point{CX, CY})
	}
	open := reachable(grid, point{CX, CY})
	rows := make([]string, H)
	for y := 0; y < H; y++ {
		var b strings.Builder
		for x := 0; x < W; x++ {
			if grid[y][x] == '.' && open[point{x, y}] {
				b.WriteByte('.')
			} else {
				b.WriteByte('#')
			}
		}
		rows[y] = b.String()
	}
	return rows
}

func foe(areaID string, index, level int, visual, name string, pos point, isBoss bool, extra *O) *O {
	bossHP, bossRet := 0, 0
	if isBoss {
		bossHP, bossRet = 6, 1
	}
	enemy := obj(
		"id", fmt.Sprintf("%s-foe-%d", areaID, index),
		"visualType", visual,
		"name", name,
		"x", pos.x, "y", pos.y,
		"hpKey", fmt.Sprintf("%sFoe%dHp", camelFlag(areaID), index),
		"maxHp", 4+level*2+bossHP,
		"retaliation", 1+level/3+bossRet,
		"optional", true,
		"activation", "always",
		"ai", aiFor(visual),
		"onDefeat", obj(
			"message", "{attacker} acaba con "+name+" usando {attack}.",
			"effects", A{obj("type", "grant-gold", "amount", 2+level*2)},
		),
	)
	if extra != nil {
		enemy.Update(extra)
	}
	return enemy
}

type areaQuests struct {
	interactables []*O
	treasures     []*O
	enemies       []*O
}

func otherAreaName(dst string) string {
	if _, ok := existing[dst]; ok {
		if dst == "C3" {
			return "Camino de los Estandartes"
		}
		return "Rookwood"
	}
	return areas[dst].name
}

func exitTo(id string, x, y int, extraPairs []any, label, locked, target, entry, message string) *O {
	e := obj("id", id, "kind", "exit")
	for i := 0; i < len(extraPairs); i += 2 {
		e.Set(extraPairs[i].(string), extraPairs[i+1])
	}
	e.Set("x", x).Set("y", y).Set("requiresReturn", true)
	e.Set("openLabel", label).Set("lockedLabel", locked).Set("requirements", A{})
	e.Set("action", obj("effects", A{obj("type", "transition-map", "mapId", target, "entryExitId", entry)}, "message", message))
	return e
}

func withXY(list []*O, p point) []*O {
	for _, e := range list {
		e.Set("x", p.x).Set("y", p.y)
	}
	return list
}

func jsonList(text string) []*O {
	var out []*O
	for _, v := range parse(text).(A) {
		out = append(out, v.(*O))
	}
	return out
}

func buildArea(code string, quests map[string]*areaQuests) *O {
	a := areas[code]
	areaID := "terra-" + strings.ToLower(code)
	level := danger(code)
	salt := saltOf(code)
	var sides []string
	for _, side := range gateOrder {
		if neighbour(code, side) != "" {
			sides = append(sides, side)
		}
	}
	content := append([]point(nil), slots...)
	var used []point
	take := func() point {
		p := content[0]
		content = content[1:]
		used = append(used, p)
		return p
	}
	var exits, interactables, treasures []*O
	for _, side := range sides {
		dst := neighbour(code, side)
		g := gates[side]
		exits = append(exits, exitTo(gateExitID(code, dst), g.x, g.y, nil,
			"Ir a "+dst+" · "+otherAreaName(dst), "El paso está cortado", mapID(dst), gateExitID(dst, code),
			"La compañía entra en "+dst+"."))
	}
	if t, ok := towns[code]; ok {
		p := take()
		exits = append(exits, exitTo(strings.ToLower(code)+"-to-town", p.x, p.y, nil,
			"Entrar en "+t.name, t.name+" · puertas cerradas", t.id, "town-gate",
			"La compañía cruza las puertas de "+t.name+"."))
	}
	if d, ok := dungeons[code]; ok {
		p := take()
		exits = append(exits, exitTo(strings.ToLower(code)+"-to-dungeon", p.x, p.y, []any{"visualType", "dungeon-arch"},
			"Entrar en "+d.name, d.name+" · sellada", d.id, "dungeon-exit",
			"La compañía desciende a "+d.name+"."))
	}
	if code == "F6" {
		// Act V: the Temple Under the Crown opens once the Dama has spoken.
		p := take()
		temple := exitTo(templeEntryExit, p.x, p.y, []any{"visualType", "dungeon-arch"},
			"Descender al Templo Bajo la Corona", "Las siete coronas no reconocen a la compañía", AtriumID, "temple-to-f6",
			"La compañía desciende por la escalinata de las siete coronas.")
		temple.Set("requirements", A{obj("key", "lostKingFinalActOpen", "truthy", true,
			"message", "Las siete coronas no ceden. La Dama, en la Corte de Bronce (D6), sabe cómo abrirlas.")})
		exits = append(exits, temple)
	}
	if line, ok := signposts[code]; ok {
		p := take()
		interactables = append(interactables, obj(
			"id", areaID+"-sign", "kind", "lore", "visualType", "signpost", "x", p.x, "y", p.y,
			"persistentVisual", true, "label", "Leer el cartel",
			"action", obj("effects", A{}, "message", line)))
	}
	if name, ok := shrines[code]; ok {
		p := take()
		flag := camelFlag(areaID) + "ShrineUsed"
		interactables = append(interactables, obj(
			"id", areaID+"-shrine", "kind", "lore", "visualType", "shrine", "x", p.x, "y", p.y,
			"label", "Beber de la "+name, "when", A{obj("key", flag, "falsy", true)},
			"action", obj("effects", A{obj("type", "set", "key", flag, "value", true), obj("type", "heal-party", "amount", 8),
				obj("type", "restore-spell-points")},
				"message", "El agua de la "+name+" está helada y sabe a hierro. La compañía recupera fuerzas y puntos de hechizo.")))
	}
	if h, ok := hermits[code]; ok {
		p := take()
		switch code {
		case "B4":
			interactables = append(interactables, withXY(jsonList(b4TaxQuestJSON), p)...)
		case "E4":
			interactables = append(interactables, withXY(jsonList(e4TaxQuestJSON), p)...)
		default:
			interactables = append(interactables, obj(
				"id", h.id, "kind", "lore", "visualType", "rookwood-mourner", "x", p.x, "y", p.y,
				"persistentVisual", true, "label", "Hablar con "+h.name,
				"action", obj("effects", A{}, "message", capFirst(h.name)+": "+h.line)))
		}
	}
	q := quests[code]
	if q != nil {
		for _, entry := range q.interactables {
			p := take()
			interactables = append(interactables, entry.With("x", p.x, "y", p.y))
		}
		for _, entry := range q.treasures {
			p := take()
			treasures = append(treasures, entry.With("x", p.x, "y", p.y))
		}
	}
	if len(content) > 0 {
		p := take()
		flag := camelFlag(areaID) + "ChestOpened"
		lootBase := []string{"sword", "axe", "mace", "spear", "dagger", "staff"}[salt%6]
		loot := tier(level) + "-" + lootBase
		gold := 6 + level*6
		treasures = append(treasures, obj(
			"id", areaID+"-chest", "kind", "pickup", "visualType", "chest", "x", p.x, "y", p.y,
			"label", "Abrir el cofre", "when", A{obj("key", flag, "falsy", true)},
			"action", obj("effects", A{obj("type", "set", "key", flag, "value", true), obj("type", "grant-gold", "amount", gold),
				obj("type", "grant-item", "itemId", loot, "name", capFirst(strings.ReplaceAll(loot, "-", " ")),
					"description", "Botín de un cofre de Terra.", "quantity", 1)},
				"message", fmt.Sprintf("El cofre guarda %d monedas y algo de equipo.", gold))))
	}

	foes := biomeFoes[a.biome]
	// Danger grows with distance from Swordhaven: more foes far away.
	count := 2
	switch {
	case level >= 5:
		count = 4
	case level >= 3:
		count = 3
	}
	var enemies []*O
	var freeFoeSlots []point
	for _, s := range foeSlots {
		taken := false
		for _, u := range used {
			if u == s {
				taken = true
			}
		}
		if !taken {
			freeFoeSlots = append(freeFoeSlots, s)
		}
	}
	// A crowded area mixes ways of fighting: prefer a species whose movement
	// pattern is not on the field yet (chroniclesBestiaryBehavior.test.js).
	seen := map[string]bool{}
	for i, offset := 0, 0; i < count; i++ {
		sp := foes[(salt+offset)%len(foes)]
		for tries := 0; tries < len(foes) && seen[signature(aiFor(sp.visual))]; tries++ {
			offset++
			sp = foes[(salt+offset)%len(foes)]
		}
		offset++
		seen[signature(aiFor(sp.visual))] = true
		enemies = append(enemies, foe(areaID, i, level, sp.visual, sp.name, freeFoeSlots[i], false, nil))
	}
	if q != nil {
		for i, entry := range q.enemies {
			s := freeFoeSlots[count+i]
			enemies = append(enemies, entry.With("x", s.x, "y", s.y))
		}
	}

	var keep []point
	for _, e := range exits {
		keep = append(keep, point{e.Int("x"), e.Int("y")})
	}
	for _, e := range append(append([]*O{}, interactables...), treasures...) {
		keep = append(keep, point{e.Int("x"), e.Int("y")})
	}
	for _, e := range enemies {
		keep = append(keep, point{e.Int("x"), e.Int("y")})
	}
	grid := areaGrid(code, a.biome, keep)
	for _, p := range keep {
		if grid[p.y][p.x] != '.' {
			panic(fmt.Sprintf("%s: %d,%d walled", code, p.x, p.y))
		}
	}
	if code == "F1" {
		lighthouse := jsonList(f1LighthouseJSON)
		for _, e := range lighthouse {
			if grid[e.Int("y")][e.Int("x")] != '.' {
				panic("F1 lighthouse entry walled: " + e.Str("id"))
			}
		}
		interactables = append(interactables, lighthouse...)
	}
	return obj(
		"id", areaID, "version", 1, "progressionKey", "terra-"+strings.ToLower(code)+"-v1",
		"title", a.name, "areaCode", code, "biome", a.biome,
		"regionKind", "wilderness", "layoutMode", "authored",
		"grid", grid, "partyStart", obj("x", CX, "y", CY, "direction", 0),
		"initialFlags", obj(), "enemies", objs(enemies), "triggers", A{},
		"interactables", objs(interactables), "treasures", objs(treasures), "traps", A{}, "exits", objs(exits),
		"initialJournal", obj("id", areaID+"-arrival", "title", code+" · "+a.name, "body", a.flavour, "sigil", code),
		"introMessage", code+" · "+a.name+". "+a.flavour,
	)
}

func objs(list []*O) A {
	out := A{}
	for _, o := range list {
		out = append(out, o)
	}
	return out
}

// ─── towns ─────────────────────────────────────────────────────────────────

var townGrid = []string{
	"###################",
	"#.................#",
	"#.###.###.###.###.#",
	"#.###.###.###.###.#",
	"#.................#",
	"#.##...........##.#",
	"#.##...........##.#",
	"#.##...........##.#",
	"#.................#",
	"#........#........#",
	"#.................#",
	"#.###.###.###.###.#",
	"#.###.###.###.###.#",
	"#.................#",
	"###################",
}

var shopStock = map[string][2][]string{
	"A3": {{"iron-dagger", "iron-spear", "iron-sword", "bronze-axe"}, {"leather-leather", "bronze-scale", "iron-ring", "bronze-shield"}},
	"C5": {{"iron-mace", "iron-spear", "bronze-sword", "ivory-staff"}, {"bronze-leather", "iron-scale", "bronze-ring", "wooden-shield"}},
	"F2": {{"steel-dagger", "iron-axe", "silver-sword", "steel-mace"}, {"iron-chain", "steel-scale", "iron-splint", "iron-shield"}},
	"C1": {{"silver-spear", "steel-sword", "ivory-dagger", "silver-staff"}, {"silver-chain", "steel-ring", "iron-plate", "silver-shield"}},
	"D6": {{"steel-sword", "steel-axe", "steel-spear", "silver-mace"}, {"steel-chain", "steel-splint", "steel-plate", "steel-shield"}},
}

type guild struct {
	name   string
	fee    int
	spells []string
}

var guilds = map[string]guild{
	"C1": {"Biblioteca de la Vigilia", 20, []string{"first-aid", "flying-fist", "elemental-arrow", "detect-magic"}},
	"F2": {"Gremio de la Llama", 15, []string{"first-aid", "elemental-arrow", "detect-magic"}},
}

func strs(list []string) A {
	out := A{}
	for _, s := range list {
		out = append(out, s)
	}
	return out
}

func buildTown(code string, people []*O) *O {
	t := towns[code]
	stock := shopStock[code]
	prefix := t.id
	interactables := []*O{
		obj("id", prefix+"-inn", "kind", "service", "x", 7, "y", 10, "visualType", "building-tavern",
			"label", "Posada · descansar y curar · 8 oro", "lockedLabel", "Posada · necesitas 8 oro",
			"requirements", A{obj("itemId", "crown-gold", "quantity", 8, "message", "El posadero cobra por adelantado.")},
			"action", obj("effects", A{obj("type", "consume-item", "itemId", "crown-gold", "quantity", 8), obj("type", "heal-party", "amount", 12),
				obj("type", "refill-class-abilities"), obj("type", "restore-spell-points")},
				"message", "La compañía duerme en la posada de "+t.name+". Heridas curadas, puntos de hechizo recuperados.")),
		obj("id", prefix+"-weapons", "kind", "merchant", "x", 7, "y", 4, "visualType", "building-forge",
			"label", "Armería de "+t.name, "shop", obj("stock", strs(stock[0])),
			"action", obj("effects", A{}, "message", "El armero no levanta la vista del afilador: «Mira lo que quieras. Rompes, pagas».")),
		obj("id", prefix+"-armour", "kind", "merchant", "x", 11, "y", 4, "visualType", "building-armor",
			"label", "Coracería de "+t.name, "shop", obj("stock", strs(stock[1])),
			"action", obj("effects", A{}, "message", "El forjador golpea una coraza al rojo: «Hecha a mano. Como mis precios».")),
		obj("id", prefix+"-temple", "kind", "service", "x", 14, "y", 6, "visualType", "building-temple",
			"label", "Templo · sanar a la compañía · 4 oro", "lockedLabel", "Templo · necesitas 4 oro",
			"requirements", A{obj("itemId", "crown-gold", "quantity", 4, "message", "El templo pide una ofrenda de cuatro monedas.")},
			"action", obj("effects", A{obj("type", "consume-item", "itemId", "crown-gold", "quantity", 4), obj("type", "heal-party", "amount", 20)},
				"message", "Los sacerdotes rezan sobre la compañía. Las heridas se cierran.")),
	}
	if g, ok := guilds[code]; ok {
		interactables = append(interactables, obj(
			"id", prefix+"-guild", "kind", "merchant", "x", 15, "y", 4, "visualType", "building-guild",
			"label", g.name+" · hechizos",
			"action", obj("effects", A{}, "message", "Una archivista encapuchada señala el registro de socios de "+g.name+"."),
			"guild", obj("membership", g.fee, "greeting", fmt.Sprintf("«%s. Firmad y pagad %d de oro, y las estanterías son vuestras».", g.name, g.fee),
				"memberGreeting", "«Lo que quepa en vuestros libros, y en vuestra bolsa».", "spells", strs(g.spells))))
	}
	interactables = append(interactables, people...)
	return obj(
		"id", t.id, "version", 1, "progressionKey", t.id+"-v1", "title", t.name, "areaCode", code,
		"regionKind", "settlement", "layoutMode", "authored", "grid", townGrid,
		"partyStart", obj("x", 9, "y", 1, "direction", 2), "initialFlags", obj(), "enemies", A{}, "triggers", A{},
		"interactables", objs(interactables), "treasures", A{}, "traps", A{},
		"exits", A{obj(
			"id", "town-gate", "kind", "exit", "x", 9, "y", 1, "requiresReturn", true,
			"openLabel", "Salir a "+code+" · "+areas[code].name, "lockedLabel", "Las puertas están cerradas", "requirements", A{},
			"action", obj("effects", A{obj("type", "transition-map", "mapId", mapID(code), "entryExitId", strings.ToLower(code)+"-to-town")},
				"message", "La compañía sale de "+t.name+"."),
		)},
		"initialJournal", obj("id", t.id+"-arrival", "title", t.name, "body", t.flavour, "sigil", code),
		"introMessage", t.name+". "+t.flavour,
	)
}

// ─── dungeons ──────────────────────────────────────────────────────────────

var dungeonFoes = map[string][]species{
	"marsh": {{"drowned", "ahogado"}, {"salt-crab", "cangrejo de salitre"}, {"bog-toad", "sapo de salina"}, {"ember-wisp", "fuego fatuo"}, {"sewer-rat", "rata de salina"}},
	"coast": {{"road-bandit", "contrabandista"}, {"salt-crab", "cangrejo de cueva"}, {"sewer-rat", "rata de bodega"}, {"ember-wisp", "farol encantado"}, {"skeleton", "contrabandista ahorcado"}},
	"ash":   {{"ash-goblin", "goblin minero"}, {"ember-wisp", "lumbre de mina"}, {"bone-hound", "sabueso de escoria"}, {"crypt-spider", "araña de galería"}, {"ash-salamander", "salamandra de la forja"}},
	"snow":  {{"scavenger-knight", "guerrero del túmulo"}, {"spectral-bishop", "sacerdote espectral"}, {"skeleton", "esqueleto del túmulo"}, {"crypt-spider", "araña de túmulo"}, {"ice-wraith", "espectro del túmulo"}},
}

func maze(seed, w, h int) [][]byte {
	grid := make([][]byte, h)
	for y := range grid {
		grid[y] = []byte(strings.Repeat("#", w))
	}
	stack := []point{{1, 1}}
	grid[1][1] = '.'
	n := seed
	dirs := []point{{2, 0}, {-2, 0}, {0, 2}, {0, -2}}
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		var options []point
		for _, d := range dirs {
			nx, ny := p.x+d.x, p.y+d.y
			if nx > 0 && nx < w-1 && ny > 0 && ny < h-1 && grid[ny][nx] == '#' {
				options = append(options, d)
			}
		}
		if len(options) == 0 {
			stack = stack[:len(stack)-1]
			continue
		}
		n = (n*1103515245 + 12345) & 0x7FFFFFFF
		d := options[n%len(options)]
		grid[p.y+d.y/2][p.x+d.x/2] = '.'
		grid[p.y+d.y][p.x+d.x] = '.'
		stack = append(stack, point{p.x + d.x, p.y + d.y})
	}
	// A few loops so the maze is not a single corridor.
	for i := 0; i < 6; i++ {
		n = (n*1103515245 + 12345) & 0x7FFFFFFF
		x := 2 + (n % (w - 4))
		y := 1 + ((n >> 8) % (h - 2))
		if grid[y][x] == '#' && ((grid[y][x-1] == '.' && grid[y][x+1] == '.') || (grid[y-1][x] == '.' && grid[y+1][x] == '.')) {
			grid[y][x] = '.'
		}
	}
	return grid
}

func distances(grid [][]byte, start point) map[point]int {
	dist := map[point]int{start: 0}
	queue := []point{start}
	for len(queue) > 0 {
		p := queue[0]
		queue = queue[1:]
		for _, s := range stepOrder {
			d := stepDir[s]
			n := point{p.x + d.x, p.y + d.y}
			if _, seen := dist[n]; grid[n.y][n.x] == '.' && !seen {
				dist[n] = dist[p] + 1
				queue = append(queue, n)
			}
		}
	}
	return dist
}
