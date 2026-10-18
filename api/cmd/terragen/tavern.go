package main

// MM3 taverns: every town's inn opens a room of its own (sleep, rations,
// a round, rumours). The night keeps the inn's authored action; the room
// adds the rest. Rumours point at real content and stop being told once
// their matter is settled (their `when` turns false).

type tavernSpec struct {
	name, keeper, greeting string
	local                  []string // rumour ids told first in this town
}

var taverns = map[string]tavernSpec{
	"A3": {"La Gaviota Tuerta", "Maese Brea", "«Pasad, que el viento de la bahía no perdona. Cama, comida o algo que contar: aquí hay de todo, menos silencio».", []string{"lighthouse", "smugglers", "ghouls", "wreckers"}},
	"C5": {"El Pilote Torcido", "Doña Salmuera", "«Cuidado con el tablón suelto. Aquí se duerme sobre el agua y se come lo que da la marisma».", []string{"bounty", "drowned", "wreckers", "witch"}},
	"F2": {"La Fragua Sedienta", "Ulda la Tostada", "«Si venís de la mina, quitaos la ceniza antes de sentaros. La cerveza es fría; lo único frío de Ascuafría».", []string{"slag", "dragon", "golem"}},
	"C1": {"El Tintero Helado", "Hermano Abel", "«Bienvenidos a la única taberna del mundo con más libros que jarras. Las jarras, por suerte, están llenas».", []string{"tower", "barrows", "wolf"}},
	"D6": {"El Último Brindis", "Leandra", "«En la Corte se brinda en voz baja desde que falta el Rey. Pedid lo que queráis, pero no cantéis».", []string{"crowns", "deserters", "tithe"}},
	"B5": {"El Molino de Vino", "Fermín el Viejo", "«Harina en las mesas y harina en la cerveza. Los molinos giran solos; nosotros, a veces».", []string{"wind", "deserters", "tithe"}},
	"E1": {"La Olla de Setas", "Marta Resina", "«Sopa de setas, pan de centeno y un fuego que no se apaga. Lo demás, preguntadlo con una moneda delante».", []string{"troll", "wolf", "tower"}},
	"D2": {"La Barrica Agria", "Orsolina", "«El vino del Rey se agria, pero el nuestro todavía se deja beber. Sentaos lejos de las barricas vacías».", []string{"tithe", "crowns", "wind"}},
}

type rumour struct {
	text string
	when A
}

// Every rumour, keyed for the towns' local ordering.
var rumours = map[string]rumour{
	"drowned":    {"En las Salinas Hundidas (C6) hay una compuerta que baja a los túneles. Dicen que el Capitán Ahogado sigue al mando ahí abajo, y que no ha soltado el timón.", A{flagIs("salinas_hundidasBossDefeated", false)}},
	"smugglers":  {"Mano Negra paga bien a quien calla y mejor a quien desaparece. Su cueva respira en las calas del suroeste (A4).", A{flagIs("cueva_contrabandistasBossDefeated", false)}},
	"slag":       {"El Capataz de Escoria no deja salir a nadie de las Minas (E3). Los mineros que bajan ya no suben, ni siquiera a cobrar.", A{flagIs("minas_de_escoriaBossDefeated", false)}},
	"barrows":    {"Siete túmulos en círculo al norte (D1). En el del centro no entra el viento, y algo vela a los muertos con más celo que un obispo.", A{flagIs("tumulos_primer_pactoBossDefeated", false)}},
	"witch":      {"Si veis luz verde sobre el agua de la Ciénaga Negra (E5), no la sigáis. La Bruja del Cieno cambia remedios por años de vida.", A{flagIs("cienaga_negraBossDefeated", false)}},
	"tower":      {"Osric, en Vigilia del Norte, busca un libro que borra nombres. Dicen que lo guarda un escriba sin cara en la Torre de los Nombres (A1).", A{flagIs("torre_de_los_nombresBossDefeated", false)}},
	"bounty":     {"El tablón de Vado de Sal paga por cinco cabecillas de los caminos. Con la bolsa entera se vive un invierno sin trabajar.", A{flagIs("vadoBountyRead", false)}},
	"deserters":  {"Brenna la Tuerta cobra peaje en los acantilados de Hollín (A2). Mandaba una compañía de la Corona; ahora manda en desertores.", A{flagIs("campA2LeaderDown", false)}},
	"wolf":       {"Los pastores del norte juran que la Loba Blanca (B1) entiende cuando hablan de ella. Por eso ya no hablan.", A{flagIs("campB1LeaderDown", false)}},
	"ghouls":     {"En la playa de los naufragios (B6) algo desentierra a los ahogados antes de que el mar se los lleve. Lo llaman el Comehuesos.", A{flagIs("campB6LeaderDown", false)}},
	"wreckers":   {"Las hogueras de las Marismas de Sal (D5) no son de pescadores: el capitán Ruy enciende luces para que las barcas encallen.", A{flagIs("campD5LeaderDown", false)}},
	"golem":      {"Los goblins de la ceniza despertaron al gólem de la cantera vieja (F4) y lo adoran como a un rey que aplasta.", A{flagIs("campF4LeaderDown", false)}},
	"lighthouse": {"Alguien enciende la linterna del Faro Roto (A6) y los barcos se estrellan. Maura, la del puerto, sabe más de lo que cuenta.", A{flagIs("hollinLighthouseStarted", false)}},
	"dragon":     {"Hilde, la herrera de Ascuafría, daría su mejor yunque por una escama del Dragón de Ceniza (F5). Nadie se ha atrevido a medir al bicho.", A{flagIs("ascuaDragonStarted", false)}},
	"wind":       {"Los molinos de Molinoviejo giran sin viento desde que algo anida en el Brezal (B2). Fermín sabe con quién hay que hablar.", A{flagIs("molinoviejoWindStarted", false)}},
	"troll":      {"Greta, la leñadora de Pinohelado, se fue hacia las Estribaciones (E2) y no volvió. Allí vive un trol al que nadie ha oído quejarse.", A{flagIs("pinoheladoGretaStarted", false)}},
	"tithe":      {"Las barricas de Viñarrey se esfuman de noche. El último que preguntó acabó en la Cripta del Obispo (E6), y no de visita.", A{flagIs("vinarreyTitheStarted", false)}},
	"crowns":     {"Bajo la Corona (F6) hay una puerta sellada con siete coronas. Dicen que tres bastan para abrirla, si sabes dónde dejarlas.", A{}},
}

// The fixed order the remaining rumours follow after a town's local ones.
var rumourOrder = []string{"drowned", "smugglers", "slag", "barrows", "witch", "tower", "bounty", "deserters", "wolf", "ghouls", "wreckers", "golem", "lighthouse", "dragon", "wind", "troll", "tithe", "crowns"}

var tavernToasts = A{
	"La compañía brinda por los que no están.",
	"Matthias brinda por el Rey; el tabernero, por que paguéis.",
	"Alguien entona una copla sobre una espada mellada. Nadie se sabe el final.",
	"Brindáis por la Corona. Un viejo en la esquina escupe en el suelo.",
}

func tavernRumours(code string) A {
	spec := taverns[code]
	seen := map[string]bool{}
	out := A{}
	add := func(id string) {
		if seen[id] {
			return
		}
		seen[id] = true
		r := rumours[id]
		entry := obj("id", id, "text", r.text)
		if len(r.when) > 0 {
			entry = obj("id", id, "text", r.text, "when", r.when)
		}
		out = append(out, entry)
	}
	for _, id := range spec.local {
		add(id)
	}
	for _, id := range rumourOrder {
		add(id)
	}
	return out
}

// tavernFor is the room a town's inn opens.
func tavernFor(code string, restPrice int) *O {
	spec := taverns[code]
	return obj("name", spec.name, "keeper", spec.keeper, "greeting", spec.greeting,
		"prices", obj("rest", restPrice, "ration", 1, "drink", 2, "tip", 1),
		"toasts", tavernToasts, "rumors", tavernRumours(code))
}
