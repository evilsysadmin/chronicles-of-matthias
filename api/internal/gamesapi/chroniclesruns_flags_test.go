package gamesapi

import (
    "encoding/json"
    "fmt"
    "strings"
    "testing"

    "go.mongodb.org/mongo-driver/v2/bson"
)

// The frontend serializes a full initiative round (actors, rolls, cursor) as
// __chrRuntime.initiative. A five-actor battle already exceeds 256 characters.
func TestNormalizeFlagsAllowsBoundedInitiativeSnapshot(t *testing.T) {
    type actor struct {
        ID string `json:"id"`
        Kind string `json:"kind"`
        Name string `json:"name"`
        Agility int `json:"agility"`
        Roll int `json:"roll"`
        Initiative int `json:"initiative"`
    }
    order := make([]actor, 0, 5)
    for i := 0; i < 5; i++ {
        kind := "party"
        if i == 4 { kind = "enemy" }
        order = append(order, actor{ID: fmt.Sprintf("hero-%d", i), Kind: kind,
            Name: fmt.Sprintf("Aventurero %d", i), Agility: 7, Roll: 4, Initiative: 11})
    }
    value, err := json.Marshal(struct {
        Version int `json:"version"`
        Die string `json:"die"`
        Round int `json:"round"`
        Cursor int `json:"cursor"`
        Order []actor `json:"order"`
    }{Version:1, Die:"1d8", Round:1, Cursor:0, Order:order})
    if err != nil { t.Fatal(err) }
    if len(value) <= 256 { t.Fatalf("test fixture unexpectedly small: %d bytes", len(value)) }

    input := bson.D{
        {Key: "__chrRuntime.phase", Value: "combat"},
        {Key: "__chrRuntime.initiative", Value: string(value)},
        {Key: "__chrRuntime.turns", Value: int64(3)},
    }
    result, err := normalizeFlags(input)
    if err != nil { t.Fatalf("real MM3 initiative snapshot rejected: %v", err) }
    if len(result) != len(input) { t.Fatalf("checkpoint flags changed: %v", result) }
}

func TestNormalizeFlagsKeepsNormalTextAndInitiativeLimits(t *testing.T) {
    cases := []struct {
        name string
        key string
        size int
        allowed bool
    }{
        {"ordinary exactly 256", "custom-story-flag", 256, true},
        {"ordinary 257 rejected", "custom-story-flag", 257, false},
        {"nearby key does not bypass limit", "__chrRuntime.initiative-fake", 257, false},
        {"initiative larger than 256", chroniclesInitiativeFlagKey, 257, true},
        {"initiative at cap", chroniclesInitiativeFlagKey, chroniclesInitiativeMaxRunes, true},
        {"initiative beyond cap", chroniclesInitiativeFlagKey, chroniclesInitiativeMaxRunes + 1, false},
    }
    for _, tt := range cases {
        t.Run(tt.name, func(t *testing.T) {
            _, err := normalizeFlags(bson.D{{Key: tt.key, Value: strings.Repeat("x", tt.size)}})
            if (err == nil) != tt.allowed { t.Fatalf("allowed=%v err=%v", tt.allowed, err) }
        })
    }
    // Special-casing one field may not bypass the aggregate checkpoint cap.
    large := bson.D{}
    for i := 0; i < 9; i++ {
        large = append(large, bson.E{Key: fmt.Sprintf("flag-%d", i), Value: strings.Repeat("x", chroniclesInitiativeMaxRunes)})
    }
    if _, err := normalizeFlags(large); err == nil {
        t.Fatal("large checkpoint bypassed aggregate limit")
    }
}
