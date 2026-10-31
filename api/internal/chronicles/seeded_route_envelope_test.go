package chronicles

import (
	"fmt"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Exercise routes actually selected by the seeded planner, not only hand-made
// snapshots: each intermediate floor must lead to the next generated stop,
// and the difficulty director must see the correct depth all the way through.
func TestSeededDungeonRouteExitsAndDifficultyStayAligned(t *testing.T) {
	partyLevel := int64(6)
	for _, seed := range []int64{0, 42, 12345} {
		t.Run(fmt.Sprintf("seed-%d", seed), func(t *testing.T) {
			planned, err := RouteSnapshotForSeed(seed)
			if err != nil {
				t.Fatal(err)
			}
			route, err := NormalizeRouteSnapshot(planned.Doc())
			if err != nil {
				t.Fatalf("generated route cannot be restored: %v", err)
			}
			if len(route.MapIDs) < 2 {
				t.Fatalf("route too short: %v", route.MapIDs)
			}
			var previousTarget int64
			for index, mapID := range route.MapIDs {
				area, err := AreaEnvelope(mapID, seed, AreaOptions{Route: route, PartyLevel: &partyLevel})
				if err != nil {
					t.Fatalf("floor %d (%s): %v", index, mapID, err)
				}
				band, ok := get(area, "difficulty").(bson.D)
				if !ok {
					t.Fatalf("floor %d: missing difficulty", index)
				}
				if got := get(band, "depth"); got != int64(index) {
					t.Errorf("floor %d: difficulty depth = %v", index, got)
				}
				target, ok := get(band, "targetLevel").(int64)
				if !ok || target < previousTarget || target > partyLevel+1 {
					t.Errorf("floor %d: invalid target %v after %d", index, get(band, "targetLevel"), previousTarget)
				}
				previousTarget = target
				manifest, ok := get(area, "manifest").(bson.D)
				if !ok {
					t.Fatalf("floor %d: missing manifest", index)
				}
				generation, ok := get(manifest, "generation").(bson.D)
				if !ok {
					t.Fatalf("floor %d: missing generation", index)
				}
				metadata, ok := get(generation, "route").(bson.D)
				if !ok {
					t.Fatalf("floor %d: missing route metadata", index)
				}
				if got := get(metadata, "index"); got != int64(index) {
					t.Errorf("floor %d: route index = %v", index, got)
				}
				if got := get(metadata, "length"); got != int64(len(route.MapIDs)) {
					t.Errorf("floor %d: route length = %v", index, got)
				}
				if got := get(metadata, "revision"); got != route.Revision(seed) {
					t.Errorf("floor %d: route revision = %v", index, got)
				}
				if index == len(route.MapIDs)-1 {
					if next := get(metadata, "nextMapId"); next != nil {
						t.Errorf("final floor invented a successor: %v", next)
					}
					continue
				}
				next := route.MapIDs[index+1]
				if got := get(metadata, "nextMapId"); got != next {
					t.Errorf("floor %d: next map = %v, want %s", index, got, next)
				}
				exitID := route.PrimaryExitIDs[mapID]
				var transitions int
				for _, exit := range docs(get(manifest, "exits")) {
					if get(exit, "id") != exitID {
						continue
					}
					action, _ := get(exit, "action").(bson.D)
					for _, effect := range docs(get(action, "effects")) {
						if get(effect, "type") == "transition-map" {
							transitions++
							if got := get(effect, "mapId"); got != next {
								t.Errorf("floor %d: primary exit leads to %v, want %s", index, got, next)
							}
						}
					}
				}
				if transitions != 1 {
					t.Errorf("floor %d: primary exit %q has %d transitions, want 1", index, exitID, transitions)
				}
			}
		})
	}
}
