package chronicles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// The route index must reach the authoritative difficulty director when the
// API builds a real shipped dungeon, not just in difficultyBand unit tests.
func TestRealDungeonAreaEnvelopeScalesWithRouteDepth(t *testing.T) {
    const mapID = "crypt-eight-squares"
    const seed int64 = 12345
    partyLevel := int64(6)
    cases := []struct {
        name string
        route RouteSnapshot
        wantDepth, wantTarget, wantDelta, wantPawnHP int64
    }{
        {
            name: "first floor",
            route: RouteSnapshot{
                PolicyVersion: 4,
                MapIDs: []string{"crypt-eight-squares", "gallery-of-forks", "echo-cistern"},
                PrimaryExitIDs: map[string]string{
                    "crypt-eight-squares": "black-gate",
                    "gallery-of-forks": "gallery-gate",
                },
            },
            wantDepth: 0, wantTarget: 3, wantDelta: 1, wantPawnHP: 6,
        },
        {
            name: "third floor",
            route: RouteSnapshot{
                PolicyVersion: 4,
                MapIDs: []string{"gallery-of-forks", "menagerie-of-ash", "crypt-eight-squares", "echo-cistern"},
                PrimaryExitIDs: map[string]string{
                    "gallery-of-forks": "gallery-gate",
                    "menagerie-of-ash": "menagerie-gate",
                    "crypt-eight-squares": "black-gate",
                },
            },
            wantDepth: 2, wantTarget: 4, wantDelta: 2, wantPawnHP: 7,
        },
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            // Prove the test uses an admissible saved route, not an arbitrary
            // in-memory object that the API would reject.
            route, err := NormalizeRouteSnapshot(tc.route.Doc())
            if err != nil {
                t.Fatalf("normalize route: %v", err)
            }
            area, err := AreaEnvelope(mapID, seed, AreaOptions{
                Route: route, PartyLevel: &partyLevel,
            })
            if err != nil {
                t.Fatalf("area envelope: %v", err)
            }
            difficulty, ok := get(area, "difficulty").(bson.D)
            if !ok {
                t.Fatal("missing combat difficulty in area envelope")
            }
            for key, want := range map[string]int64{
                "depth": tc.wantDepth,
                "targetLevel": tc.wantTarget,
                "appliedDelta": tc.wantDelta,
            } {
                if got := get(difficulty, key); got != want {
                    t.Errorf("%s = %v, want %d", key, got, want)
                }
            }
            manifest := get(area, "manifest").(bson.D)
            routeMeta := get(get(manifest, "generation").(bson.D), "route").(bson.D)
            if got := get(routeMeta, "index"); got != tc.wantDepth {
                t.Errorf("generated route index = %v, want %d", got, tc.wantDepth)
            }
            foundPawn := false
            for _, enemy := range docs(get(manifest, "enemies")) {
                if get(enemy, "id") == "corrupted-pawn" {
                    foundPawn = true
                    if got := get(enemy, "maxHp"); got != tc.wantPawnHP {
                        t.Errorf("corrupted pawn HP = %v, want %d", got, tc.wantPawnHP)
                    }
                }
            }
            if !foundPawn {
                t.Fatal("shipped dungeon lost its required corrupted pawn")
            }
        })
    }
    authored, _, err := LoadManifest(mapID)
    if err != nil {
        t.Fatal(err)
    }
    for _, enemy := range docs(get(authored, "enemies")) {
        if get(enemy, "id") == "corrupted-pawn" && get(enemy, "maxHp") != int64(5) {
            t.Fatalf("authored pawn HP mutated: %v", get(enemy, "maxHp"))
        }
    }
}
