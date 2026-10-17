package main

// The main story «El rey desaparecido» from Vado de Sal to the Corte de
// Bronce, and the side quests each town hands out across the map.

import (
	"fmt"
	"strings"
)

func grantItem(itemID, name, description string) *O {
	return obj("type", "grant-item", "itemId", itemID, "name", name, "description", description, "quantity", 1)
}

func bossDrops() map[string]*O {
	drops := map[string]*O{
		"C6": grantItem("squire-testimony", "Testimonio del escudero", "El escudero Bran, el último de la escolta, dejó escrito lo que vio: la campana de Puerto de Hollín sonó la noche de la emboscada."),
		"A4": grantItem("bell-ledger", "Registro de la campana", "Los contrabandistas cobraban por tocar la campana. El último pago, en lingotes con marca de Ascuafría."),
		"E3": grantItem("hollow-crown-mould", "Molde de la corona hueca", "Un molde de corona sin peso. Lleva un sello que no es de la Corona: el del Primer Pacto."),
		"D1": grantItem("oath-tablet", "Tablilla del juramento", "La tablilla del Primer Pacto. Quien la lea en voz alta puede reclamar el juramento del Rey."),
		"E5": grantItem("witch-ladle", "Cucharón de la bruja", "Un cucharón de hueso, todavía tibio. Prueba de que la bruja no volverá a cocinar."),
	}
	for code, drop := range expansionBossDrops() {
		drops[code] = drop
	}
	for code, drop := range thirdWaveBossDrops() {
		drops[code] = drop
	}
	return drops
}

// step is one face of a townsperson: who stands at a door, when they speak,
// and what speaking does.
func step(personID string, x, y int, visual, label string, when A, effects A, message string, journal *O, kind string, requirements A, locked string) *O {
	if kind == "" {
		kind = "lore"
	}
	entry := obj("id", personID, "kind", kind, "x", x, "y", y, "visualType", visual, "label", label, "when", when,
		"action", obj("effects", effects, "message", message))
	if journal != nil {
		entry.Obj("action").Set("journal", journal)
	}
	if len(requirements) > 0 {
		entry.Set("requirements", requirements)
		if locked == "" {
			locked = label
		}
		entry.Set("lockedLabel", locked)
	}
	return entry
}

func reward(rewardID, flag string, gold, amount int, objective string, requirements A) *O {
	effects := A{obj("type", "set", "key", flag, "value", true), obj("type", "grant-gold", "amount", gold), xp(rewardID, amount)}
	if objective != "" {
		effects = append(effects, adv(objective))
	}
	return obj("type", "claim-reward", "rewardId", rewardID, "requirements", requirements, "effects", effects)
}

type door struct {
	x, y   int
	visual string
}

func journal(id, title, body, sigil string) *O {
	return obj("id", id, "title", title, "body", body, "sigil", sigil)
}

func when(pairs ...*O) A {
	out := A{}
	for _, p := range pairs {
		out = append(out, p)
	}
	return out
}

func flagIs(key string, truthy bool) *O {
	if truthy {
		return obj("key", key, "truthy", true)
	}
	return obj("key", key, "falsy", true)
}

type storyOut struct {
	people map[string][]*O
	areas  map[string]*areaQuests
}

func (s *storyOut) area(code string) *areaQuests {
	if s.areas[code] == nil {
		s.areas[code] = &areaQuests{}
	}
	return s.areas[code]
}

func story() storyOut {
	s := storyOut{people: map[string][]*O{}, areas: map[string]*areaQuests{}}
	bossFlag := map[string]string{}
	for code, d := range dungeons {
		bossFlag[code] = camelFlag(d.id) + "BossDefeated"
	}

	chain := func(code, giverID, giver string, at door, beforeFlag, startFlag, startLine, objective,
		bossDone, doneFlag, rewardID string, gold, amount int, doneLine, nextObjective, sigil string) {
		g := capFirst(giver)
		s.people[code] = append(s.people[code], step(
			giverID+"-brief", at.x, at.y, at.visual, "Hablar con "+giver,
			when(flagIs(beforeFlag, true), flagIs(startFlag, false)),
			A{obj("type", "set", "key", startFlag, "value", true), adv(objective)}, startLine,
			journal("lost-king-"+giverID, g, objective, sigil), "", nil, ""))
		s.people[code] = append(s.people[code], step(
			giverID+"-report", at.x, at.y, at.visual, fmt.Sprintf("Informar a %s · %d oro", giver, gold),
			when(flagIs(startFlag, true), flagIs(doneFlag, false)),
			A{reward(rewardID, doneFlag, gold, amount, nextObjective, A{flagIs(bossDone, true)})},
			doneLine, journal("lost-king-"+giverID+"-done", g+" ha hablado", nextObjective, sigil),
			"quest", A{obj("key", bossDone, "truthy", true, "message", g+" espera: «Todavía no. "+objective+"»")},
			g+" · «"+objective+"»"))
	}

	hall := door{11, 10, "building-hall"}
	chain("C5", "nela", "la barquera Nela", hall, "swordhavenRouteReported", "vadoNelaBriefed",
		"Nela amarra la barca y mira la hoja de ruta de Garrah: «Esta etapa no existe. Los caballeros nunca cruzaron el vado. Los que volvieron, volvieron muertos, y se los tragaron las Salinas Hundidas, al sur»",
		"Baja a las Salinas Hundidas (C6) y encuentra lo que queda de la escolta de los caballeros.",
		bossFlag["C6"], "vadoNelaReported", "terra:salinas:v1", 40, 80,
		"Nela lee el testimonio del escudero con los labios apretados: «La campana de Puerto de Hollín. Alguien la tocó para avisar de que la escolta pasaba. Id al oeste»",
		"El escudero oyó la campana de Puerto de Hollín (A3) la noche de la emboscada. Habla con el campanero.", "♛")
	chain("A3", "ulric", "el campanero Ulric", hall, "vadoNelaReported", "hollinUlricBriefed",
		"Ulric se frota las manos negras de hollín: «Yo no la toqué. Fueron los de las calas. Me quitaron la llave del campanario y me dejaron un saco de monedas para callar»",
		"Entra en la Cueva de los Contrabandistas (A4) y recupera el registro de la campana.",
		bossFlag["A4"], "hollinUlricReported", "terra:contrabandistas:v1", 50, 100,
		"Ulric pasa los dedos por el registro: «Lingotes de Ascuafría. Allí funden todo lo que brilla, y también lo que no debería existir»",
		"El registro paga en lingotes de Ascuafría (F2). Busca a la maestra fundidora Hilde.", "♛")
	chain("F2", "hilde", "la maestra fundidora Hilde", hall, "hollinUlricReported", "ascuafriaHildeBriefed",
		"Hilde se seca el sudor con el antebrazo: «Me encargaron un molde de corona que no pesaba nada. Lo rechacé. Otro lo fundió en las Minas de Escoria, de noche»",
		"Encuentra el molde de la corona hueca en las Minas de Escoria (E3).",
		bossFlag["E3"], "ascuafriaHildeReported", "terra:escoria:v1", 60, 120,
		"Hilde gira el molde al fuego: «Este sello no es de la Corona. Es del Primer Pacto. Sólo el archivero de la Vigilia sabe leerlo»",
		"El molde lleva el sello del Primer Pacto. Llévalo al archivero ciego de Vigilia del Norte (C1).", "♛")
	chain("C1", "osric", "el archivero ciego Osric", hall, "ascuafriaHildeReported", "vigiliaOsricBriefed",
		"Osric recorre el sello con la yema de los dedos: «El Pacto. Alguien quiere jurar en nombre del Rey. Para eso necesita la tablilla que duerme en los Túmulos, al este»",
		"Desciende a los Túmulos del Primer Pacto (D1) y trae la tablilla del juramento antes que nadie.",
		bossFlag["D1"], "vigiliaOsricReported", "terra:tumulos:v1", 70, 150,
		"Osric sostiene la tablilla contra el pecho: «Ahora nadie puede usurpar el juramento. Llevádsela a la Dama, a la Corte de Bronce. Y no os fiéis del Canciller»",
		"Lleva la tablilla del juramento a la Dama, en la Corte de Bronce (D6).", "♛")
	s.people["D6"] = append(s.people["D6"], damaPeople()...)

	// Side quests: one hunt and one errand per town, each pointing to an area.
	hunt := func(code, giverID, giver string, at door, where, beastVisual, beastName, line, doneLine string, gold, amount int, bossDone string) {
		flag := bossDone
		if flag == "" {
			flag = camelFlag(giverID) + "Hunted"
		}
		questID := giverID + "-hunt"
		started := camelFlag(giverID) + "HuntStarted"
		s.people[code] = append(s.people[code], step(
			giverID+"-hunt-brief", at.x, at.y, at.visual, "Hablar con "+giver,
			when(flagIs(started, false)),
			A{obj("type", "set", "key", started, "value", true),
				obj("type", "start-quest", "questId", questID, "title", "Caza: "+beastName, "description", line,
					"objective", "Acaba con "+beastName+" en "+where+" · "+areas[where].name+".", "order", 40)}, line, nil, "", nil, ""))
		s.people[code] = append(s.people[code], step(
			giverID+"-hunt-report", at.x, at.y, at.visual, fmt.Sprintf("Cobrar la caza a %s · %d oro", giver, gold),
			when(obj("questId", questID, "questStatus", "active")),
			A{obj("type", "claim-reward", "rewardId", "terra:"+questID+":v1", "requirements", A{flagIs(flag, true)},
				"effects", A{obj("type", "complete-quest", "questId", questID, "objective", "Side quest completada."),
					obj("type", "grant-gold", "amount", gold), xp("terra:"+questID+":v1", amount)})},
			doneLine, nil, "quest", A{obj("key", flag, "truthy", true, "message", "«"+capFirst(beastName)+" sigue vivo en "+where+"».")},
			capFirst(giver)+" · «¿Ya cayó "+beastName+"?»"))
		if bossDone != "" {
			return
		}
		level := danger(where) + 1
		toHit, armorClass := combatRating(level + 1)
		s.area(where).enemies = append(s.area(where).enemies, obj(
			"id", giverID+"-quarry", "visualType", beastVisual, "name", beastName, "hpKey", camelFlag(giverID)+"QuarryHp",
			"maxHp", 10+level*3, "retaliation", 2+level/3, "toHit", toHit, "armorClass", armorClass, "agility", speedFor(beastVisual, level+1), "optional", true, "activation", "always",
			"defeatedFlag", flag, "ai", aiFor(beastVisual),
			"onDefeat", obj("message", "{attacker} abate a "+beastName+" con {attack}.", "effects", A{obj("type", "set", "key", flag, "value", true)}),
		))
	}

	errand := func(code, giverID, giver string, at door, where, itemID, itemName, line, doneLine string, gold, amount int) {
		questID := giverID + "-errand"
		started := camelFlag(giverID) + "ErrandStarted"
		lower := strings.ToLower(itemName)
		s.people[code] = append(s.people[code], step(
			giverID+"-errand-brief", at.x, at.y, at.visual, "Hablar con "+giver,
			when(flagIs(started, false)),
			A{obj("type", "set", "key", started, "value", true),
				obj("type", "start-quest", "questId", questID, "title", itemName, "description", line,
					"objective", "Busca "+lower+" en "+where+" · "+areas[where].name+" y tráelo.", "order", 45)}, line, nil, "", nil, ""))
		s.people[code] = append(s.people[code], step(
			giverID+"-errand-report", at.x, at.y, at.visual, fmt.Sprintf("Entregar %s · %d oro", lower, gold),
			when(obj("questId", questID, "questStatus", "active")),
			A{obj("type", "claim-reward", "rewardId", "terra:"+questID+":v1", "requirements", A{obj("itemId", itemID)},
				"effects", A{obj("type", "consume-item", "itemId", itemID, "quantity", 1),
					obj("type", "complete-quest", "questId", questID, "objective", "Side quest completada."),
					obj("type", "grant-gold", "amount", gold), xp("terra:"+questID+":v1", amount)})},
			doneLine, nil, "quest", A{obj("itemId", itemID, "message", "«¿Y "+lower+"? Está en "+where+"».")},
			capFirst(giver)+" · espera "+lower))
		found := camelFlag(giverID) + "ErrandFound"
		s.area(where).treasures = append(s.area(where).treasures, obj(
			"id", giverID+"-errand-item", "kind", "pickup", "visualType", "chest", "label", "Recoger "+lower,
			"when", A{obj("questId", questID, "questStatus", "active"), flagIs(found, false)},
			"action", obj("effects", A{obj("type", "set", "key", found, "value", true),
				grantItem(itemID, itemName, "Lo que pidió "+giver+".")}, "message", "Aquí está: "+lower+"."),
		))
	}

	watch := door{4, 6, "building-watch"}
	store := door{15, 10, "building-store"}
	hunt("C5", "vado-watch", "el alguacil del vado", watch, "D5", "salt-crab", "la Reina Tenaza",
		"«Una cangreja del tamaño de un carro se come las redes en las Marismas de Sal (D5). Paga el concejo».",
		"El alguacil cuenta las monedas despacio: «Esta noche se cena cangrejo en todo Vado de Sal».", 30, 50, "")
	hunt("C5", "vado-herbalist", "la curandera Ada", store, "E5", "mire-witch", "la Bruja del Cieno",
		"«La bruja de la Ciénaga Negra (E5) envenena los pozos. Hay quien dice que vive en una choza sobre el agua, bajo tierra».",
		"Ada huele el aire: «Ya se nota. El agua vuelve a saber a agua».", 45, 90, bossFlag["E5"])
	errand("A3", "hollin-fisher", "la pescadera Iria", store, "A5", "lost-net-charm", "El amuleto de las redes",
		"«Mi marido se ahogó en los Arrecifes del Naufragio (A5) con el amuleto de la familia. Sin él no pesca nadie».",
		"Iria aprieta el amuleto: «Mañana salen las barcas».", 25, 40)
	hunt("A3", "hollin-watch", "el capitán del puerto", watch, "A2", "drowned", "el Ahogado del Acantilado",
		"«Algo sube de noche por los Acantilados de Hollín (A2) y se lleva a los vigías».",
		"«El puerto duerme tranquilo. Tomad, os lo habéis ganado».", 30, 60, "")
	errand("F2", "ascua-smith", "el aprendiz Tomé", store, "F3", "lava-glass", "Cristal de lava",
		"«La maestra necesita cristal de lava de las Crestas Volcánicas (F3) para templar acero. Yo no me atrevo a ir».",
		"Tomé sonríe de oreja a oreja: «¡La maestra va a creer que fui yo!».", 35, 60)
	hunt("F2", "ascua-watch", "la capitana de la forja", watch, "F4", "gate-jailer", "el Coloso de Escoria",
		"«En la Fundición en Ruinas (F4) algo enorme se mueve entre los hornos. Que alguien lo apague».",
		"«Ni el coloso pudo con vosotros. Respeto»", 45, 90, "")
	errand("C1", "vigilia-monk", "el monje copista", store, "B1", "pilgrim-stone", "La piedra del peregrino",
		"«En el Paso de los Juramentos (B1) los viajeros dejan piedras con su nombre. Tráeme la más antigua: quiero copiarla».",
		"El monje acaricia la piedra: «Un nombre de antes del Pacto. Gracias».", 35, 60)
	hunt("C1", "vigilia-watch", "el sargento de la Vigilia", watch, "A1", "bone-hound", "el Cuervo Blanco",
		"«Una bestia de hueso con plumas de cuervo caza en el Glaciar (A1). Ya van tres patrullas».",
		"«Que lo canten los bardos. Yo sólo pago».", 50, 100, "")
	errand("D6", "corte-steward", "la mayordoma de la Corte", store, "E6", "abbey-bell", "La campanilla de la abadía",
		"«La Dama quiere oír la campanilla de las Ruinas del Obispo (E6). Dicen que trae paz a quien la oye».",
		"La mayordoma envuelve la campanilla en seda: «Hoy dormirá alguien en esta corte».", 40, 70)
	hunt("D6", "corte-guard", "el capitán de la guardia", watch, "F5", "ember-wisp", "el Fantasma del Dragón",
		"«Una luz roja recorre el Desierto de Ceniza (F5) junto al esqueleto del dragón. Las caravanas no pasan».",
		"«Las caravanas volverán. Y con ellas, los impuestos».", 50, 100, "")
	expansionStory(&s, hunt, errand)
	thirdWaveStory(&s)
	return s
}
