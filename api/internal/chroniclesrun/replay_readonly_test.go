package chroniclesrun

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/pydoc"
)

func TestReadDocPreservesComparisonSemantics(t *testing.T) {
	var nilDoc bson.D
	for _, input := range []any{nil, nilDoc, bson.D{}, "invalid", bson.A{}, bson.D{{Key: "nested", Value: bson.A{int32(1)}}}} {
		got, copied := readDoc(input), orDoc(input)
		if got == nil || !reflect.DeepEqual(got, copied) {
			t.Fatalf("read-only document differs from copied document for %T: %v vs %v", input, got, copied)
		}
	}
}

func TestTerminalReplayReadOnlyAndPublicIsolation(t *testing.T) {
	status := "completed"
	flags := bson.D{{Key: "door", Value: bson.D{{Key: "open", Value: true}}}}
	inventory := bson.D{{Key: "gold", Value: int32(7)}}
	quests := bson.D{{Key: "finished", Value: bson.A{"quest-a"}}}
	row := bson.D{
		{Key: "_id", Value: "run-a"},
		{Key: "status", Value: status},
		{Key: "worldVersion", Value: int32(2)},
		{Key: "currentMapId", Value: "map-a"},
		{Key: "contentVersion", Value: int32(1)},
		{Key: "manifestRevision", Value: "revision-a"},
		{Key: "worldFlags", Value: flags},
		{Key: "inventory", Value: inventory},
		{Key: "quests", Value: quests},
		{Key: "consumedContentIds", Value: bson.A{"item-a"}},
		{Key: "claimedRewards", Value: bson.A{}},
	}
	checkpoint := Checkpoint{
		TerminalStatus: &status, ExpectedWorldVersion: 1,
		MapID: "map-a", ContentVersion: 1, ManifestRevision: "revision-a",
		WorldFlags: copyDoc(flags), Inventory: copyDoc(inventory), Quests: copyDoc(quests),
		ConsumedContentIDs: []string{"item-a"},
	}
	before := pydoc.DeepCopy(row)
	if !terminalReplayMatches(row, checkpoint) {
		t.Fatal("identical checkpoint must match")
	}
	checkpoint.Inventory[0].Value = int32(8)
	if terminalReplayMatches(row, checkpoint) {
		t.Fatal("different checkpoint must not match")
	}
	if !reflect.DeepEqual(row, before) {
		t.Fatal("read-only replay comparison mutated stored row")
	}
	public := Public(row)
	get(public, "worldFlags").(bson.D)[0].Value.(bson.D)[0].Value = false
	get(public, "inventory").(bson.D)[0].Value = int32(99)
	get(public, "quests").(bson.D)[0].Value.(bson.A)[0] = "changed"
	if !reflect.DeepEqual(row, before) {
		t.Fatal("public response shares mutable checkpoint state")
	}
}
