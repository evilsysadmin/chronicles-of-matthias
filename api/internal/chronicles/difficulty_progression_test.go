package chronicles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Depth is a gameplay input, not just a label on the generated area. Keep the
// Go director's actual bands in step with the documented two-floor cadence.
func TestDifficultyBandProgressesWithDungeonDepth(t *testing.T) {
	tests := []struct {
		depth, target int64
	}{
		{0, 3},
		{1, 3},
		{2, 4},
		{4, 5},
		{6, 6},
		{8, 7},
		{12, 7}, // No encounter above one level over the deployed party.
		{99, 7},
	}
	for _, tc := range tests {
		band := difficultyBand(6, tc.depth)
		if got := get(band, "targetLevel"); got != tc.target {
			t.Errorf("depth %d: targetLevel = %v, want %d", tc.depth, got, tc.target)
		}
		if got := get(band, "maxLevel").(int64); got > 7 {
			t.Errorf("depth %d: maxLevel = %d, want <= 7", tc.depth, got)
		}
	}
}

// The same authored enemy should become more dangerous on deeper floors,
// without modifying the manifest used for other seeds or later runs.
func TestApplyDifficultyScalesDeepFloorsWithoutMutatingAuthoredEnemy(t *testing.T) {
	manifest := bson.D{
		{Key: "proceduralDifficulty", Value: int64(3)},
		{Key: "enemies", Value: bson.A{bson.D{
			{Key: "id", Value: "guardian"},
			{Key: "maxHp", Value: int64(9)},
			{Key: "retaliation", Value: int64(2)},
			{Key: "enemyBuild", Value: bson.D{{Key: "level", Value: int64(3)}}},
		}}},
	}
	tests := []struct {
		depth, wantHP, wantDamage, wantLevel, wantDelta int64
	}{
		{0, 9, 2, 3, 0},
		{6, 12, 3, 6, 3},
		{12, 12, 3, 6, 3}, // Delta cap still protects deep-floor balance.
	}
	for _, tc := range tests {
		scaled, difficulty, err := applyDifficulty(manifest, 6, tc.depth)
		if err != nil {
			t.Fatalf("depth %d: applyDifficulty: %v", tc.depth, err)
		}
		if got := get(difficulty, "appliedDelta"); got != tc.wantDelta {
			t.Errorf("depth %d: appliedDelta = %v, want %d", tc.depth, got, tc.wantDelta)
		}
		enemies := get(scaled, "enemies").(bson.A)
		enemy := enemies[0].(bson.D)
		if got := get(enemy, "maxHp"); got != tc.wantHP {
			t.Errorf("depth %d: maxHp = %v, want %d", tc.depth, got, tc.wantHP)
		}
		if got := get(enemy, "retaliation"); got != tc.wantDamage {
			t.Errorf("depth %d: retaliation = %v, want %d", tc.depth, got, tc.wantDamage)
		}
		build := get(enemy, "enemyBuild").(bson.D)
		if got := get(build, "level"); got != tc.wantLevel {
			t.Errorf("depth %d: enemyBuild.level = %v, want %d", tc.depth, got, tc.wantLevel)
		}
	}
	original := get(manifest, "enemies").(bson.A)[0].(bson.D)
	if got := get(original, "maxHp"); got != int64(9) {
		t.Errorf("authored maxHp mutated to %v", got)
	}
	if got := get(original, "retaliation"); got != int64(2) {
		t.Errorf("authored retaliation mutated to %v", got)
	}
	if got := get(get(original, "enemyBuild").(bson.D), "level"); got != int64(3) {
		t.Errorf("authored enemyBuild.level mutated to %v", got)
	}
}
