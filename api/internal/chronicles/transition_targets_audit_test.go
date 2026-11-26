package chronicles

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestTransitionTargetsCollectsOnlyStringMapIDs(t *testing.T) {
	effect := func(kind string, id any) bson.D {
		return bson.D{{Key: "type", Value: kind}, {Key: "mapId", Value: id}}
	}
	owner := func(key string, effects ...any) bson.D {
		return bson.D{{Key: key, Value: bson.D{{Key: "effects", Value: bson.A(effects)}}}}
	}
	manifest := bson.D{}
	want := map[string]bool{"enemy-target": true, "duplicate": true, "": true}
	for _, group := range contentGroups {
		want[group] = true
		manifest = append(manifest, bson.E{Key: group, Value: bson.A{
			"malformed-entry",
			owner("action", effect("transition-map", group), effect("transition-map", "duplicate"),
				effect("other", "ignored"), effect("transition-map", int32(12)), nil),
			owner("onDefeat", effect("transition-map", "ignored-content-defeat")),
			bson.D{{Key: "action", Value: "malformed-action"}},
		}})
	}
	manifest = append(manifest, bson.E{Key: "enemies", Value: bson.A{
		owner("onDefeat", effect("transition-map", "enemy-target"), effect("transition-map", "")),
		owner("action", effect("transition-map", "ignored-enemy-action")),
	}})
	if got := TransitionTargets(manifest); !reflect.DeepEqual(got, want) {
		t.Fatalf("targets = %v; want %v", got, want)
	}
	if got := TransitionTargets(nil); got == nil || len(got) != 0 {
		t.Fatalf("empty manifest must return a non-nil empty set, got %v", got)
	}
}
