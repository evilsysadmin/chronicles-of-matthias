package chronicles

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Rewriting a route's primary exit must not corrupt the authored manifest or
// another run's exit when two different routes share the same source map.
func TestApplyRoutePlanDoesNotMutateSourceOrEarlierRun(t *testing.T) {
	base := bson.D{
		{Key: "id", Value: "crypt-eight-squares"},
		{Key: "exits", Value: bson.A{bson.D{
			{Key: "id", Value: "black-gate"},
			{Key: "action", Value: bson.D{{Key: "effects", Value: bson.A{
				bson.D{{Key: "type", Value: "transition-map"}, {Key: "mapId", Value: "authored-next"}},
				bson.D{{Key: "type", Value: "heal-party"}, {Key: "amount", Value: int64(2)}},
			}}}},
		}}},
	}
	authored := copyDoc(base)
	target := func(doc bson.D) any {
		exit := docs(get(doc, "exits"))[0]
		action := get(exit, "action").(bson.D)
		for _, effect := range docs(get(action, "effects")) {
			if get(effect, "type") == "transition-map" {
				return get(effect, "mapId")
			}
		}
		return nil
	}
	route := func(next string) *RouteSnapshot {
		return &RouteSnapshot{
			PolicyVersion: 4,
			MapIDs: []string{"crypt-eight-squares", next},
			PrimaryExitIDs: map[string]string{"crypt-eight-squares": "black-gate"},
		}
	}
	first, err := applyRoutePlan(base, 42, route("gallery-of-forks"))
	if err != nil {
		t.Fatal(err)
	}
	if got := target(first); got != "gallery-of-forks" {
		t.Fatalf("first route target = %v", got)
	}
	if !reflect.DeepEqual(base, authored) {
		t.Fatal("first route mutated the authored manifest")
	}
	second, err := applyRoutePlan(base, 42, route("echo-cistern"))
	if err != nil {
		t.Fatal(err)
	}
	if got := target(second); got != "echo-cistern" {
		t.Fatalf("second route target = %v", got)
	}
	if got := target(first); got != "gallery-of-forks" {
		t.Fatalf("second route overwrote first run's exit: %v", got)
	}
	if !reflect.DeepEqual(base, authored) {
		t.Fatal("second route mutated the authored manifest")
	}
}


// A seeded route changes only the destination; authored transition metadata
// must survive, including fields added by future content revisions.
func TestApplyRoutePlanPreservesTransitionEffectFields(t *testing.T) {
	transition := bson.D{
		{Key: "type", Value: "transition-map"},
		{Key: "mapId", Value: "authored-next"},
		{Key: "requiresFlag", Value: "gate-open"},
		{Key: "metadata", Value: bson.D{{Key: "label", Value: "crypt gate"}}},
	}
	manifest := bson.D{
		{Key: "id", Value: "crypt-eight-squares"},
		{Key: "exits", Value: bson.A{bson.D{
			{Key: "id", Value: "black-gate"},
			{Key: "action", Value: bson.D{{Key: "effects", Value: bson.A{transition}}}},
		}}},
	}
	authored := copyDoc(manifest)
	route := &RouteSnapshot{
		PolicyVersion: 4,
		MapIDs: []string{"crypt-eight-squares", "gallery-of-forks"},
		PrimaryExitIDs: map[string]string{"crypt-eight-squares": "black-gate"},
	}
	updated, err := applyRoutePlan(manifest, 42, route)
	if err != nil {
		t.Fatal(err)
	}
	exits := docs(get(updated, "exits"))
	if len(exits) != 1 {
		t.Fatalf("rewritten exits = %v", exits)
	}
	action, ok := get(exits[0], "action").(bson.D)
	if !ok {
		t.Fatalf("rewritten exit has no action")
	}
	effects, ok := get(action, "effects").(bson.A)
	if !ok || len(effects) != 1 {
		t.Fatalf("rewritten effects = %v", effects)
	}
	got, ok := effects[0].(bson.D)
	if !ok {
		t.Fatalf("rewritten transition = %T", effects[0])
	}
	want := setKey(copyDoc(transition), "mapId", "gallery-of-forks")
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("rewritten transition = %v, want %v", got, want)
	}
	if !reflect.DeepEqual(manifest, authored) {
		t.Fatal("rewriting the route changed authored transition metadata")
	}
}
