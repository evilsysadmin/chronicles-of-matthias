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
