package chronicles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestAuthoredDifficultyIgnoresMalformedEnemyEntries(t *testing.T) {
	tests := []struct {
		name     string
		manifest bson.D
		want     int64
	}{
		{
			name: "mixed valid and malformed enemies",
			manifest: bson.D{{Key: "enemies", Value: bson.A{
				bson.D{{Key: "maxHp", Value: int64(13)}},
				"invalid legacy enemy",
				nil,
			}}},
			want: 5,
		},
		{
			name: "valid enemies retain their average",
			manifest: bson.D{{Key: "enemies", Value: bson.A{
				bson.D{{Key: "maxHp", Value: int64(5)}},
				bson.D{{Key: "maxHp", Value: int64(11)}},
			}}},
			want: 3,
		},
		{
			name: "large legacy HP values cannot overflow the threat average",
			manifest: bson.D{{Key: "enemies", Value: bson.A{
				bson.D{{Key: "maxHp", Value: int64(1<<63 - 1)}},
				bson.D{{Key: "maxHp", Value: int64(1<<63 - 1)}},
			}}},
			want: 5,
		},
		{
			name: "a huge enemy remains dangerous alongside a weak enemy",
			manifest: bson.D{{Key: "enemies", Value: bson.A{
				bson.D{{Key: "maxHp", Value: int64(1<<63 - 1)}},
				bson.D{{Key: "maxHp", Value: int64(1)}},
			}}},
			want: 5,
		},
		{
			name: "all malformed enemies use baseline",
			manifest: bson.D{{Key: "enemies", Value: bson.A{"invalid", nil}}},
			want: 1,
		},
		{
			name: "explicit procedural difficulty remains authoritative",
			manifest: bson.D{
				{Key: "proceduralDifficulty", Value: int64(2)},
				{Key: "enemies", Value: bson.A{"invalid"}},
			},
			want: 2,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := authoredDifficulty(tc.manifest)
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.want {
				t.Fatalf("authoredDifficulty() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestApplyDifficultySaturatesLegacyEnemyStats(t *testing.T) {
	const maxInt64 = int64(1<<63 - 1)
	cases := []struct {
		name               string
		authored, party     int64
		depth, hp           int64
		retaliation         int64
		wantHP, wantDamage  int64
	}{
		{"maximum legacy stats", 1, 12, 12, maxInt64, maxInt64, maxInt64, maxInt64},
		{"near-maximum legacy stats", 1, 12, 12, maxInt64 - 1, maxInt64 - 1, maxInt64, maxInt64},
		{"ordinary positive scaling", 1, 12, 12, 7, 3, 10, 4},
		{"ordinary negative scaling", 5, 1, 0, 10, 2, 8, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			manifest := bson.D{
				{Key: "proceduralDifficulty", Value: tc.authored},
				{Key: "enemies", Value: bson.A{bson.D{
					{Key: "maxHp", Value: tc.hp},
					{Key: "retaliation", Value: tc.retaliation},
				}}},
			}
			scaled, _, err := applyDifficulty(manifest, tc.party, tc.depth)
			if err != nil {
				t.Fatal(err)
			}
			enemies, ok := get(scaled, "enemies").(bson.A)
			if !ok || len(enemies) != 1 {
				t.Fatalf("scaled enemies = %v", get(scaled, "enemies"))
			}
			enemy, ok := enemies[0].(bson.D)
			if !ok {
				t.Fatalf("scaled enemy = %T", enemies[0])
			}
			if got := get(enemy, "maxHp"); got != tc.wantHP {
				t.Errorf("maxHp = %v, want %d", got, tc.wantHP)
			}
			if got := get(enemy, "retaliation"); got != tc.wantDamage {
				t.Errorf("retaliation = %v, want %d", got, tc.wantDamage)
			}
		})
	}
}
