package main

// Terra, second wave: three more towns, three more dungeons and side
// quests where the company has to choose, MM3 style (a deal or a sword).
//
//	Molinoviejo (B5)  · El viento prestado: pact with the harpy or kill her
//	Pinohelado  (E1)  · La leñadora y el trol: heal Grum or collect his head
//	Viñarrey    (D2)  · El diezmo del Canciller: hand Orsino over or take his bribe
//	Cripta del Obispo (E6), Guarida del Dragón de Ceniza (F5), Faro Roto (A6)
//
// Every choice leaves a flag the campaign epilogue reads.

type huntFn func(code, giverID, giver string, at door, where, beastVisual, beastName, line, doneLine string, gold, amount int, bossDone string)
type errandFn func(code, giverID, giver string, at door, where, itemID, itemName, line, doneLine string, gold, amount int)

func init() {
	areas["B5"] = area{"Molinos del Oeste", "plains", "Molinos que giran sin viento junto a las casas de Molinoviejo. Nadie quiere saber por qué."}
	areas["E1"] = area{"Bosque de Escarcha", "forest", "Pinos cargados de hielo crujen como huesos viejos. Entre ellos humea Pinohelado."}
	areas["D2"] = area{"Viñedos del Rey", "plains", "Vides sin vendimiar alrededor de Viñarrey. Las uvas se pudren desde que el Rey desapareció."}

	for _, code := range []string{"B5", "E1", "D2"} {
		townOrder = append(townOrder, code)
	}
	towns["B5"] = town{"molinoviejo", "Molinoviejo", "Casas de piedra a la sombra de molinos que giran solos. El pan sabe a harina y a algo más."}
	towns["E1"] = town{"pinohelado", "Pinohelado", "Cabañas de leñadores entre pinos helados. Huele a resina y a sopa de setas."}
	towns["D2"] = town{"vinarrey", "Viñarrey", "Lagares vacíos y barricas apiladas. El vino del Rey se agria esperando a su dueño."}
	shopStock["B5"] = [2][]string{{"iron-mace", "iron-axe", "iron-spear", "wooden-bow"}, {"iron-leather", "iron-scale", "iron-ring", "iron-shield"}}
	shopStock["E1"] = [2][]string{{"silver-axe", "silver-spear", "steel-dagger", "ivory-staff"}, {"steel-leather", "silver-scale", "silver-ring", "ivory-shield"}}
	shopStock["D2"] = [2][]string{{"bronze-sword", "iron-dagger", "iron-staff", "bronze-mace"}, {"bronze-leather", "bronze-ring", "iron-scale", "bronze-shield"}}
	guilds["E1"] = guild{"Círculo de la Escarcha", 25, []string{"first-aid", "elemental-arrow", "cold-ray", "poison-cloud", "heal-wounds"}}
	guilds["D2"] = guild{"Hermandad del Lagar", 20, []string{"first-aid", "flying-fist", "heal-wounds", "holy-strike"}}
	// The old libraries learn new pages too.
	guilds["C1"] = guild{"Biblioteca de la Vigilia", 20, []string{"first-aid", "flying-fist", "elemental-arrow", "detect-magic", "lightning-bolt", "heal-wounds"}}

	signposts["B5"] = "Cartel: Molinoviejo, aquí mismo. Al norte, la calzada hacia Puerto de Hollín (A3)."
	signposts["E1"] = "Cartel: Pinohelado, entre los pinos. Al sur, las Estribaciones de Escoria (E2)."
	signposts["D2"] = "Cartel: Viñarrey, entre las viñas. Al este, Ascuafría (F2); al norte, la Vigilia (C1)."

	for _, code := range []string{"E6", "F5", "A6"} {
		dungeonOrder = append(dungeonOrder, code)
	}
	dungeons["E6"] = dungeon{"cripta-del-obispo", "Cripta del Obispo", "Cripta", "crypt", boss{"spectral-bishop", "el Obispo Hueco", 30, 1.3}}
	dungeons["F5"] = dungeon{"guarida-del-dragon", "Guarida del Dragón de Ceniza", "Guarida", "ash", boss{"ash-salamander", "el Dragón de Ceniza", 44, 1.9}}
	dungeons["A6"] = dungeon{"faro-roto", "Faro Roto", "Faro", "coast", boss{"drowned", "la Farera Ahogada", 30, 1.2}}
	dungeonFoes["crypt"] = []species{{"skeleton", "esqueleto de monje"}, {"spectral-bishop", "monje espectral"}, {"crypt-spider", "araña de osario"},
		{"ice-wraith", "alma en pena"}, {"ember-wisp", "cirio fatuo"}}

	dungeonExtras["E6"] = dungeonExtra{
		noteLabel: "Leer el libro de horas del abad",
		note:      "«Vísperas: las barricas de Viñarrey llegan de noche y bajan a la cripta. El mayordomo Orsino cobra; el Canciller paga. Completas: el Obispo ya no reza. Escucha.» La última página está en blanco, como si alguien la hubiera olvidado a propósito.",
		fontName:  "Agua bendita del claustro",
		elite:     species{"skeleton", "el sacristán"},
		eliteLine: "El sacristán guarda la llave de la sacristía entre las costillas.",
		keyID:     "sacristy-key", keyName: "Llave de la sacristía",
		cacheLabel: "Abrir la sacristía", cache: "En la sacristía quedan cálices de plata, una maza de ceremonia y un anillo de abad.",
		cacheLoot: []string{"silver-mace", "steel-ring"},
		trapLabel: "Losa del osario", trapMsg: "La losa cede sobre un osario. Los huesos de abajo no se alegran de veros.",
	}
	dungeonExtras["F5"] = dungeonExtra{
		noteLabel: "Leer los grabados del cubil",
		note:      "Alguien grabó en la roca: «Aquí durmió un dragón al que el Silencio dejó sin nombre antes de que naciera. Por eso no muere: nadie recuerda que vive». Debajo, en otra letra: «Lleva sus escamas a Ascuafría».",
		fontName:  "Manantial de agua tibia",
		elite:     species{"ash-goblin", "el cuidador de la nidada"},
		eliteLine: "El cuidador de la nidada lleva colgada la llave del tesoro del dragón.",
		keyID:     "hoard-key", keyName: "Llave del tesoro",
		cacheLabel: "Abrir el tesoro del dragón", cache: "El tesoro del dragón: monedas fundidas en una sola masa, una espada de acero y una armadura de placas que alguien no llegó a estrenar.",
		cacheLoot: []string{"steel-sword", "steel-plate"},
		trapLabel: "Grieta de ceniza", trapMsg: "Una grieta exhala ceniza ardiente. El dragón no necesita estar despierto para quemar.",
	}
	dungeonExtras["A6"] = dungeonExtra{
		noteLabel: "Leer el diario de la farera",
		note:      "«Mi hermana Maura dice que el faro es para los barcos. Yo digo que es para los que se pierden. Esta noche algo sin nombre me pide que apague la luz.» La última línea está escrita con otra mano, mojada: «encendida».",
		fontName:  "Cisterna de lluvia",
		elite:     species{"harpy", "la arpía del faro"},
		eliteLine: "La arpía del faro anida con la llave del cuarto de la linterna.",
		keyID:     "lantern-room-key", keyName: "Llave del cuarto de la linterna",
		cacheLabel: "Abrir el cuarto de la linterna", cache: "En el cuarto de la linterna: el sueldo de un año de farera, una lanza de plata y un escudo de marfil.",
		cacheLoot: []string{"silver-spear", "ivory-shield"},
		trapLabel: "Escalón podrido", trapMsg: "Un escalón podrido cede y la compañía se golpea contra la barandilla de hierro.",
	}
}

func expansionBossDrops() map[string]*O {
	return map[string]*O{
		"E6": grantItem("tithe-ledger", "Registro del diezmo", "Barricas de Viñarrey entregadas al Silencio, firmadas por el mayordomo Orsino y por una V."),
		"F5": grantItem("dragon-scale", "Escama de dragón", "Una escama del tamaño de un escudo, todavía caliente. Hilde, en Ascuafría, sabría qué hacer con ella."),
		"A6": grantItem("lighthouse-key", "Llave del Faro Roto", "La farera ahogada la apretaba en el puño. Con ella se apaga la linterna para siempre."),
	}
}

// questStep is a person's face during one stage of a side quest.
func questStep(id string, at door, label string, whenList A, effects A, message string, j *O, requirements A, locked string) *O {
	kind := ""
	if len(requirements) > 0 {
		kind = "quest"
	}
	return step(id, at.x, at.y, at.visual, label, whenList, effects, message, j, kind, requirements, locked)
}

func sideQuest(questID, title, description, objective string, order int) *O {
	return obj("type", "start-quest", "questId", questID, "title", title, "description", description, "objective", objective, "order", order)
}

func advanceSide(questID, objective string) *O {
	return obj("type", "advance-quest", "questId", questID, "objective", objective)
}

func completeSide(questID, objective string) *O {
	return obj("type", "complete-quest", "questId", questID, "objective", objective)
}

func active(questID string) *O { return obj("questId", questID, "questStatus", "active") }

func set(key string, value any) *O { return obj("type", "set", "key", key, "value", value) }

func expansionStory(s *storyOut, hunt huntFn, errand errandFn) {
	hall := door{11, 10, "building-hall"}
	watch := door{4, 6, "building-watch"}
	store := door{15, 10, "building-store"}

	// ── Molinoviejo · El viento prestado ────────────────────────────────
	const wind = "molinoviejo-wind"
	s.people["B5"] = append(s.people["B5"],
		questStep("fermin-wind-brief", hall, "Hablar con el molinero Fermín",
			A{flagIs("molinoviejoWindStarted", false)},
			A{set("molinoviejoWindStarted", true),
				sideQuest(wind, "El viento prestado", "Los molinos de Molinoviejo giran sin viento desde que la Señora del Viento anida en el Brezal de los Lobos (B2). Cada luna se cobra un cordero; la última, al sobrino de Fermín.",
					"Sube al Brezal de los Lobos (B2) y resuelve el asunto de la Señora del Viento: a espada o con el grano de Fermín.", 50),
				grantItem("blessed-grain", "Saco de grano de Fermín", "Lo que pide la Señora del Viento a cambio de seguir soplando.")},
			"Fermín se sacude la harina del delantal: «Los molinos giran solos desde que la Señora del Viento anida en el Brezal de los Lobos, en B2. Al principio era una bendición. Ahora se lleva un cordero cada luna, y la última luna se llevó a mi sobrino. Si queréis hablar con ella, llevadle este grano: es lo que pide. Si no, ya sabéis lo que hacen los héroes»",
			journal("molinoviejo-wind", "El viento prestado", "La Señora del Viento anida en B2. Pactar con el grano de Fermín o acabar con ella.", "◆"), nil, ""),
		questStep("fermin-wind-pact", hall, "Contarle a Fermín el pacto · 30 oro",
			A{active(wind), flagIs("molinoviejoWindPact", true)},
			A{obj("type", "claim-reward", "rewardId", "terra:molinoviejo-wind:pact:v1", "requirements", A{flagIs("molinoviejoWindPact", true)},
				"effects", A{completeSide(wind, "Pacto sellado: los molinos siguen girando."), obj("type", "grant-gold", "amount", 30),
					xp("terra:molinoviejo-wind:v1", 80)})},
			"Fermín abraza a su sobrino, que ha bajado del brezal con plumas en el pelo: «Un cordero por luna es buen precio por pan y por sobrino. Que siga soplando»",
			journal("molinoviejo-wind-pact", "Un viento con precio", "La compañía pactó con la Señora del Viento. Molinoviejo conserva sus molinos y paga un cordero cada luna.", "◆"), nil, ""),
		questStep("fermin-wind-slain", hall, "Contarle a Fermín que la Señora del Viento ha muerto · 60 oro",
			A{active(wind), flagIs("molinoviejoWindSlain", true)},
			A{obj("type", "claim-reward", "rewardId", "terra:molinoviejo-wind:slain:v1", "requirements", A{flagIs("molinoviejoWindSlain", true)},
				"effects", A{completeSide(wind, "La Señora del Viento ha caído. Los molinos se han parado."), obj("type", "grant-gold", "amount", 60),
					xp("terra:molinoviejo-wind:v1", 80)})},
			"Los molinos se detienen mientras Fermín cuenta las monedas. Su sobrino vuelve a casa, pálido. «Volveremos a moler a mano», dice Fermín. «Pero nadie más desaparecerá.»",
			journal("molinoviejo-wind-slain", "Molinos quietos", "La compañía mató a la Señora del Viento. Molinoviejo muele a mano, pero ya no paga tributo.", "◆"), nil, ""),
	)
	s.area("B2").enemies = append(s.area("B2").enemies, obj(
		"id", "b2-wind-matron", "visualType", "harpy", "visualScale", 1.3, "name", "la Señora del Viento", "hpKey", "b2WindMatronHp",
		"maxHp", 24, "retaliation", 3, "optional", true, "activation", "always", "defeatedFlag", "b2WindMatronGone",
		"ai", obj("movement", "hold", "attackReach", 1, "engagedMovement", "knight-chase", "engageRange", 1),
		"blockingMessage", "La Señora del Viento abre las alas: «¿Grano o acero, forasteros?»",
		"onDefeat", obj("message", "{attacker} derriba a la Señora del Viento con {attack}.",
			"effects", A{set("b2WindMatronGone", true), set("molinoviejoWindSlain", true),
				advanceSide(wind, "La Señora del Viento ha caído. Vuelve con Fermín (B5).")},
			"journal", journal("b2-wind-matron", "Cae la Señora del Viento", "Entre las plumas del nido duerme el sobrino de Fermín, vivo.", "†")),
	))
	s.area("B2").interactables = append(s.area("B2").interactables, obj(
		"id", "b2-wind-nest", "kind", "lore", "visualType", "shrine", "label", "Dejar el grano de Fermín en el nido y pactar",
		"lockedLabel", "El nido de la Señora del Viento", "when", A{active(wind), flagIs("b2WindMatronGone", false)},
		"requirements", A{obj("itemId", "blessed-grain", "quantity", 1, "message", "La Señora del Viento no acepta palabras: acepta grano.")},
		"action", obj("effects", A{obj("type", "consume-item", "itemId", "blessed-grain", "quantity", 1),
			set("molinoviejoWindPact", true), set("b2WindMatronGone", true),
			advanceSide(wind, "Pacto sellado con la Señora del Viento. Vuelve con Fermín (B5).")},
			"message", "Vacías el saco en el nido. La Señora del Viento picotea el grano, os mira largo rato y suelta un chiflido: de entre las plumas sale el sobrino de Fermín, despeinado y vivo. Luego alza el vuelo hacia los molinos.",
			"journal", journal("b2-wind-pact", "Grano por viento", "La Señora del Viento aceptó el grano y devolvió al sobrino de Fermín.", "◆")),
	))
	hunt("B5", "molinoviejo-watch", "la guardia del molino", watch, "B4", "sewer-rat", "el Rey Rata",
		"«Hay una rata del tamaño de un perro en las Granjas del Trigo (B4). Se come el grano de tres graneros».",
		"«Por fin se podrá guardar el trigo en paz. Tomad».", 30, 50, "")

	// ── Pinohelado · La leñadora y el trol ─────────────────────────────
	const greta = "pinohelado-greta"
	s.people["E1"] = append(s.people["E1"],
		questStep("joris-greta-brief", hall, "Hablar con el leñador Joris",
			A{flagIs("pinoheladoGretaStarted", false)},
			A{set("pinoheladoGretaStarted", true),
				sideQuest(greta, "La leñadora y el trol", "Greta, la hija de Joris, no volvió de las Estribaciones de Escoria (E2). Los cazadores dicen que allí vive un trol.",
					"Busca a Greta en las Estribaciones de Escoria (E2).", 50)},
			"Joris aprieta el mango del hacha: «Mi hija Greta subió a por leña a las Estribaciones de Escoria, en E2, hace tres días. Los cazadores dicen que allí vive un trol. Traedla. Viva, si puede ser»",
			journal("pinohelado-greta", "La leñadora y el trol", "Greta desapareció en E2, donde vive un trol.", "◆"), nil, ""),
		questStep("joris-greta-healed", hall, "Volver con Joris y Greta · 40 oro",
			A{active(greta), flagIs("pinoheladoGrumHealed", true)},
			A{obj("type", "claim-reward", "rewardId", "terra:pinohelado-greta:healed:v1", "requirements", A{flagIs("pinoheladoGrumHealed", true)},
				"effects", A{completeSide(greta, "Grum se curó y Greta volvió a casa."), obj("type", "grant-gold", "amount", 40),
					grantItem("steel-axe", "Hacha de Grum", "Un hacha de acero que Grum dejó en la puerta de Joris. Los trols también dan las gracias."),
					xp("terra:pinohelado-greta:v1", 90)})},
			"Greta entra corriendo en casa. Esa noche aparece un hacha de acero clavada en la puerta de Joris, y huellas enormes que se pierden hacia el monte. «Los trols también dan las gracias», dice Greta.",
			journal("pinohelado-grum-healed", "Un trol agradecido", "La compañía curó a Grum. Greta volvió y el trol dejó un hacha de regalo.", "◆"), nil, ""),
		questStep("joris-greta-slain", hall, "Volver con Joris y Greta · 50 oro",
			A{active(greta), flagIs("pinoheladoGrumSlain", true)},
			A{obj("type", "claim-reward", "rewardId", "terra:pinohelado-greta:slain:v1", "requirements", A{flagIs("pinoheladoGrumSlain", true)},
				"effects", A{completeSide(greta, "Grum ha muerto. Greta ha vuelto, pero no os habla."), obj("type", "grant-gold", "amount", 50),
					xp("terra:pinohelado-greta:v1", 60)})},
			"Joris paga sin dudar. Greta no os mira: «Me salvó de los lobos. Y vosotros le cobrasteis la cabeza».",
			journal("pinohelado-grum-slain", "Una cabeza de trol", "La compañía mató a Grum. Joris pagó; Greta no lo perdona.", "◆"), nil, ""),
	)
	s.area("E2").enemies = append(s.area("E2").enemies, obj(
		"id", "e2-grum", "visualType", "troll", "visualScale", 1.15, "name", "Grum, el trol herido", "hpKey", "e2GrumHp",
		"maxHp", 30, "retaliation", 4, "optional", true, "activation", "always", "defeatedFlag", "e2GrumGone",
		"ai", obj("movement", "hold", "attackReach", 1, "engagedMovement", "cardinal-chase", "engageRange", 1),
		"blockingMessage", "Grum gruñe de dolor y no se aparta de la cueva.",
		"onDefeat", obj("message", "{attacker} derriba a Grum con {attack}.",
			"effects", A{set("e2GrumGone", true), set("pinoheladoGrumSlain", true),
				advanceSide(greta, "Grum ha muerto. Lleva a Greta con su padre, en Pinohelado (E1).")},
			"journal", journal("e2-grum", "Cae Grum", "El trol cae junto a la cueva. Greta llora.", "†")),
	))
	s.area("E2").interactables = append(s.area("E2").interactables,
		obj("id", "e2-greta", "kind", "lore", "visualType", "rookwood-mourner", "label", "Hablar con Greta",
			"when", A{active(greta), flagIs("e2GrumGone", false)},
			"action", obj("effects", A{set("e2GretaFound", true),
				advanceSide(greta, "Cura a Grum con musgo de escarcha del Bosque de Escarcha (E1), o acaba con él.")},
				"message", "Greta se planta delante de la cueva: «¡No le hagáis daño! Grum me salvó de los lobos y le mordieron la pierna. Si le traéis musgo de escarcha del bosque de Pinohelado, en E1, se curará y se irá monte arriba»")),
		obj("id", "e2-grum-cure", "kind", "lore", "visualType", "shrine", "label", "Curar a Grum con el musgo de escarcha",
			"lockedLabel", "La pierna de Grum necesita musgo de escarcha", "when", A{active(greta), flagIs("e2GrumGone", false)},
			"requirements", A{obj("itemId", "frost-moss", "quantity", 1, "message", "Hace falta musgo de escarcha del Bosque de Escarcha (E1).")},
			"action", obj("effects", A{obj("type", "consume-item", "itemId", "frost-moss", "quantity", 1),
				set("e2GrumGone", true), set("pinoheladoGrumHealed", true),
				advanceSide(greta, "Grum se ha curado. Acompaña a Greta a Pinohelado (E1).")},
				"message", "Grum deja que le pongáis el musgo en la pierna con la cara de quien soporta a unos dentistas. Se levanta, os mira, mira a Greta y se va monte arriba cojeando cada vez menos.",
				"journal", journal("e2-grum-cured", "Musgo para un trol", "Grum se curó y se marchó al monte.", "◆"))),
	)
	s.area("E1").treasures = append(s.area("E1").treasures, obj(
		"id", "e1-frost-moss", "kind", "pickup", "visualType", "chest", "label", "Arrancar musgo de escarcha",
		"when", A{active(greta), flagIs("e2GretaFound", true), flagIs("e1FrostMossTaken", false)},
		"action", obj("effects", A{set("e1FrostMossTaken", true),
			grantItem("frost-moss", "Musgo de escarcha", "Cura heridas de trol y, según los leñadores, también las de leñador.")},
			"message", "Bajo la nieve, al pie de un pino viejo, el musgo de escarcha brilla como cristal verde."),
	))
	hunt("E1", "pinohelado-watch", "el cazador mayor", watch, "C2", "harpy", "la Arpía Coronada",
		"«En las Colinas de la Corona (C2) caza una arpía con una diadema robada. Se lleva las piezas de los cepos y a los perros».",
		"«Con esto compro cepos nuevos. Y perros nuevos».", 45, 80, "")

	// ── Viñarrey · El diezmo del Canciller ─────────────────────────────
	const tithe = "vinarrey-tithe"
	s.people["D2"] = append(s.people["D2"],
		questStep("calixta-tithe-brief", hall, "Hablar con la vinatera Calixta",
			A{flagIs("vinarreyTitheStarted", false)},
			A{set("vinarreyTitheStarted", true),
				sideQuest(tithe, "El diezmo del Canciller", "El mayordomo Orsino cobra en Viñarrey un diezmo de vino en nombre del Canciller. Las barricas salen hacia la Corte… y nunca llegan.",
					"Busca adónde van las barricas: en la Cripta del Obispo (E6) dicen que se oye vino caer.", 50)},
			"Calixta golpea una barrica vacía: «El mayordomo Orsino cobra un diezmo de vino en nombre del Canciller. Las barricas salen hacia la Corte… y nunca llegan. Los de las Ruinas del Obispo, en E6, dicen que por las noches se oye vino caer bajo tierra»",
			journal("vinarrey-tithe", "El diezmo del Canciller", "Las barricas de Viñarrey desaparecen. Pista: la Cripta del Obispo (E6).", "◆"), nil, ""),
		questStep("calixta-tithe-judge", hall, "Entregar el registro a Calixta · 40 oro",
			A{active(tithe)},
			A{obj("type", "claim-reward", "rewardId", "terra:vinarrey-tithe:v1", "requirements", A{obj("itemId", "tithe-ledger", "quantity", 1)},
				"effects", A{obj("type", "consume-item", "itemId", "tithe-ledger", "quantity", 1), set("vinarreyOrsinoJudged", true),
					completeSide(tithe, "Orsino será juzgado por el pueblo."), obj("type", "grant-gold", "amount", 40),
					xp("terra:vinarrey-tithe:v1", 90)})},
			"Calixta lee el registro en voz alta en la plaza. A Orsino lo sacan de su casa en camisón. «No lo colgaremos», dice Calixta. «Va a pisar uva hasta que pague cada barrica»",
			journal("vinarrey-orsino-judged", "La uva de Orsino", "La compañía entregó el registro. Viñarrey juzgó a Orsino.", "◆"),
			A{obj("itemId", "tithe-ledger", "quantity", 1, "message", "Calixta necesita pruebas: algo de la Cripta del Obispo (E6).")},
			"Calixta espera pruebas de la Cripta del Obispo (E6)"),
	)
	s.people["D2"] = append(s.people["D2"],
		questStep("orsino-bribe", store, "Hablar con el mayordomo Orsino",
			A{active(tithe), obj("itemId", "tithe-ledger", "quantity", 1)},
			A{obj("type", "claim-reward", "rewardId", "terra:vinarrey-tithe:v1", "requirements", A{obj("itemId", "tithe-ledger", "quantity", 1)},
				"effects", A{obj("type", "consume-item", "itemId", "tithe-ledger", "quantity", 1), set("vinarreyOrsinoBribed", true),
					completeSide(tithe, "Orsino compró vuestro silencio."), obj("type", "grant-gold", "amount", 90),
					xp("terra:vinarrey-tithe:v1", 30)})},
			"Orsino ve el registro y palidece. Luego sonríe y pone una bolsa sobre la mesa: «Noventa monedas por ese papel, y aquí no ha pasado nada». Os lleváis la bolsa. El papel arde en su chimenea.",
			journal("vinarrey-orsino-bribed", "Noventa monedas", "La compañía vendió el registro a Orsino. El diezmo sigue.", "◆"), nil, ""),
	)
	hunt("D2", "vinarrey-watch", "el guarda del lagar", watch, "D4", "bog-toad", "el Sapo Rey",
		"«Un sapo como un tonel se ha instalado en las Lindes de las Marismas (D4). Se come a los perros del lagar».",
		"«Esta noche brindamos por vosotros. Con vino agrio, que es el que queda».", 40, 70, "")

	// ── Dungeon quests in old towns ────────────────────────────────────
	const scale = "ascua-dragon-scale"
	s.people["F2"] = append(s.people["F2"],
		questStep("hilde-dragon-brief", hall, "Preguntar a Hilde por el dragón",
			A{flagIs("ascuafriaHildeReported", true), flagIs("ascuaDragonStarted", false)},
			A{set("ascuaDragonStarted", true),
				sideQuest(scale, "Escama de dragón", "Hilde quiere forjar con una escama del Dragón de Ceniza, que duerme en el Desierto de Ceniza (F5).",
					"Baja a la Guarida del Dragón de Ceniza (F5) y trae una escama.", 55)},
			"Hilde se limpia las manos: «Ya que estáis de paso por el sur: en el Desierto de Ceniza, en F5, duerme un dragón que nadie recuerda. Traedme una escama y os forjo el mejor escudo de Terra»",
			journal("ascua-dragon", "Escama de dragón", "Hilde forjará un escudo con una escama del Dragón de Ceniza (F5).", "◆"), nil, ""),
		questStep("hilde-dragon-report", hall, "Entregar la escama a Hilde · 120 oro",
			A{active(scale)},
			A{obj("type", "claim-reward", "rewardId", "terra:ascua-dragon-scale:v1", "requirements", A{obj("itemId", "dragon-scale", "quantity", 1)},
				"effects", A{obj("type", "consume-item", "itemId", "dragon-scale", "quantity", 1),
					completeSide(scale, "Hilde ha forjado un escudo con la escama."), obj("type", "grant-gold", "amount", 120),
					grantItem("steel-shield", "Escudo de escama de dragón", "Hilde lo forjó con la escama del Dragón de Ceniza. Todavía está tibio."),
					xp("terra:ascua-dragon-scale:v1", 150)})},
			"Hilde trabaja la escama toda la noche. Al amanecer os da un escudo que todavía está tibio: «Si algún día vuelve a nacer un dragón, que se lo piense dos veces».",
			journal("ascua-dragon-done", "Un escudo tibio", "Hilde forjó un escudo con la escama del Dragón de Ceniza.", "◆"),
			A{obj("itemId", "dragon-scale", "quantity", 1, "message", "Hilde: «Sin escama no hay escudo. El dragón duerme en F5».")},
			"Hilde espera la escama del dragón"),
	)
	const light = "hollin-lighthouse"
	s.people["A3"] = append(s.people["A3"],
		questStep("maura-light-brief", door{15, 4, "building-hall"}, "Hablar con la vieja farera Maura",
			A{flagIs("hollinLighthouseStarted", false)},
			A{set("hollinLighthouseStarted", true),
				sideQuest(light, "La luz de la isla", "La hermana de Maura cuidaba el Faro Roto (A6). Se ahogó, y desde entonces algo enciende la linterna para estrellar barcos.",
					"Entra en el Faro Roto (A6) y apaga lo que enciende la linterna.", 55)},
			"Maura reza junto al altar: «Mi hermana cuidaba el Faro Roto, en la isla de A6. Se ahogó la noche que el Silencio pasó por la costa. Desde entonces algo enciende la linterna para que los barcos se estrellen. Apagadla. Apagadla a ella, si hace falta»",
			journal("hollin-lighthouse", "La luz de la isla", "Algo enciende la linterna del Faro Roto (A6) para estrellar barcos.", "◆"), nil, ""),
		questStep("maura-light-report", door{15, 4, "building-hall"}, "Devolver la llave del faro a Maura · 80 oro",
			A{active(light)},
			A{obj("type", "claim-reward", "rewardId", "terra:hollin-lighthouse:v1", "requirements", A{obj("itemId", "lighthouse-key", "quantity", 1)},
				"effects", A{obj("type", "consume-item", "itemId", "lighthouse-key", "quantity", 1),
					completeSide(light, "El Faro Roto está apagado y la farera descansa."), obj("type", "grant-gold", "amount", 80),
					xp("terra:hollin-lighthouse:v1", 120)})},
			"Maura sostiene la llave contra el pecho: «Ya puede descansar. Y los barcos, volver»",
			journal("hollin-lighthouse-done", "Una luz apagada", "La farera ahogada cayó. Maura guarda la llave del Faro Roto.", "◆"),
			A{obj("itemId", "lighthouse-key", "quantity", 1, "message", "Maura: «La llave la tiene ella. En el Faro Roto, en A6»")},
			"Maura espera noticias del Faro Roto (A6)"),
	)
}
