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
