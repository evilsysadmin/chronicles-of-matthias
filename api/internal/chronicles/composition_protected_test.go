package chronicles

import (
    "testing"

    "go.mongodb.org/mongo-driver/v2/bson"
)

// Optional seed variation must not delete a required or protected encounter
// merely because a legacy manifest reused its ID for a variable enemy.
func TestCompositionPreservesProtectedEnemiesWithSharedOptionalID(t *testing.T) {
    manifest := bson.D{
        {Key: "id", Value: "duplicate-id-composition"},
        {Key: "enemies", Value: bson.A{
            bson.D{{Key: "id", Value: "guardian"}, {Key: "hpKey", Value: "required_guardian_hp"}},
            bson.D{{Key: "id", Value: "guardian"}, {Key: "optional", Value: true}},
            bson.D{{Key: "id", Value: "guardian"}, {Key: "optional", Value: true}, {Key: "hpKey", Value: "optional_guardian_hp"}},
        }},
    }
    // Find a deterministic seed which omits the variable guardian while
    // leaving the other two entries protected from composition.
    omittedSeed := int64(-1)
    for seed := int64(0); seed < 128; seed++ {
        plan := compositionFor(manifest, seed)
        if len(plan.omitted) > 0 {
            omittedSeed = seed
            break
        }
    }
    if omittedSeed < 0 {
        t.Fatal("could not find a seed omitting the variable encounter")
    }
    composed, plan := applyComposition(manifest, omittedSeed)
    if len(plan.omitted) != 1 || plan.omitted[0] != "guardian" {
        t.Fatalf("unexpected omitted plan: %v", plan.omitted)
    }
    if len(plan.protected) != 1 || plan.protected[0] != "guardian" {
        t.Fatalf("unexpected protected plan: %v", plan.protected)
    }
    enemies := docs(get(composed, "enemies"))
    if len(enemies) != 2 {
        t.Fatalf("composed enemies = %d, want required and protected guardian", len(enemies))
    }
    if get(enemies[0], "optional") == true || get(enemies[0], "hpKey") != "required_guardian_hp" {
        t.Errorf("required guardian changed or omitted: %v", enemies[0])
    }
    if get(enemies[1], "optional") != true || get(enemies[1], "hpKey") != nil {
        t.Errorf("protected optional guardian changed or omitted: %v", enemies[1])
    }
    if got := len(docs(get(manifest, "enemies"))); got != 3 {
        t.Errorf("authored manifest mutated: %d enemies, want 3", got)
    }
}
