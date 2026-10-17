package main

// Usable items, ranged arms and master spells (the fourth wave of Terra's
// content). Every generated town gets a botica at the free door (3,4) that
// sells potions and scrolls; the armourers add bows, crossbows and slings to
// their racks; the guilds learn the first spells that shape a whole fight.

// apothecaryStock: the frontier towns sell the basics, the deep towns the
// strong draughts. Ids match frontend/src/chronicles/chroniclesConsumables.js.
var apothecaryStock = map[string][]string{}

var apothecaryName = map[string]string{
	"A3": "Botica del Faro",
	"C5": "Botica de Ada",
	"B5": "Botica del Molino",
	"D2": "Botica del Lagar",
	"F2": "Botica de la Ceniza",
	"C1": "Botica de la Vigilia",
	"E1": "Botica de la Resina",
	"D6": "Botica de la Corte",
}

func init() {
	basic := []string{"healing-potion", "mana-potion", "fire-scroll"}
	middle := []string{"healing-potion", "mana-potion", "revive-draught", "fire-scroll"}
	deep := []string{"healing-potion", "greater-healing-potion", "mana-potion", "revive-draught", "fire-scroll", "lightning-scroll"}
	for _, code := range []string{"A3", "C5"} {
		apothecaryStock[code] = basic
	}
	for _, code := range []string{"B5", "D2"} {
		apothecaryStock[code] = middle
	}
	for _, code := range []string{"F2", "C1", "E1", "D6"} {
		apothecaryStock[code] = deep
	}

	// Ranged arms: material climbs with the town's depth, like the blades.
	ranged := map[string][]string{
		"A3": {"bronze-crossbow", "brass-sling"},
		"C5": {"wooden-longbow", "bronze-sling"},
		"B5": {"iron-crossbow", "iron-sling"},
		"D2": {"bronze-longbow", "brass-crossbow"},
		"F2": {"iron-longbow", "iron-crossbow"},
		"C1": {"silver-longbow"},
		"E1": {"silver-crossbow", "silver-longbow"},
		"D6": {"steel-longbow", "steel-crossbow"},
	}
	for code, extra := range ranged {
		stock := shopStock[code]
		stock[0] = append(append([]string{}, stock[0]...), extra...)
		shopStock[code] = stock
	}

	// Master spells. Fireball for the arcane schools of the north and the
	// forge, Paralizar and Sanación en grupo for the frost circle, the
	// clerics of the vineyard keep Escudo de fe.
	learn := map[string][]string{
		"C1": {"fireball", "faith-ward", "mass-heal"},
		"F2": {"fireball"},
		"E1": {"paralyze", "mass-heal"},
		"D2": {"faith-ward", "paralyze"},
	}
	for code, spells := range learn {
		g := guilds[code]
		g.spells = append(append([]string{}, g.spells...), spells...)
		guilds[code] = g
	}
}

// apothecary is the botica's counter for a generated town, or nil.
func apothecary(code string, t town) *O {
	stock, ok := apothecaryStock[code]
	if !ok {
		return nil
	}
	name := apothecaryName[code]
	if name == "" {
		name = "Botica de " + t.name
	}
	return obj("id", t.id+"-apothecary", "kind", "merchant", "x", 3, "y", 4, "visualType", "building-apothecary",
		"label", name+" · pociones y pergaminos", "shop", obj("stock", strs(stock),
			"greeting", "«Pociones para las heridas, maná para los magos y pergaminos para quien no sabe leer runas. Se paga antes de beber»."),
		"action", obj("effects", A{}, "message", "Huele a hierbas, cera y algo que chisporrotea en un frasco."))
}
