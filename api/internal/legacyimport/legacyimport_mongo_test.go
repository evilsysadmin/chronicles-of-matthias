package legacyimport

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
)

// CI's MongoDB is disposable; never run this against an actual player database.
// The URI is set only in the api-e2e job's isolated Mongo service.
func TestMongoSourceReadsEveryOwnerRunBeyondNetworkBatch(t *testing.T) {
	uri := os.Getenv("LEGACY_IMPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("ephemeral CI MongoDB not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(context.Background())
	db := client.Database(fmt.Sprintf("chronicles_legacyimport_ci_%d", time.Now().UnixNano()))
	defer db.Drop(context.Background())

	const count = 231 // Cross the previous hard cap of 200.
	rows := make([]any, 0, count+1)
	for n := 0; n < count; n++ {
		rows = append(rows, bson.D{
			{Key: "_id", Value: fmt.Sprintf("archive-%03d", n)},
			{Key: "owner", Value: "synthetic-owner"},
			{Key: "worldVersion", Value: int32(n)},
			{Key: "inventory", Value: bson.D{{Key: "potions", Value: int32(2)}}},
		})
	}
	rows = append(rows, bson.D{
		{Key: "_id", Value: "other-players-run"},
		{Key: "owner", Value: "someone-else"},
	})
	if _, err := db.Collection(runsCollection).InsertMany(ctx, rows); err != nil {
		t.Fatal(err)
	}
	source := NewMongoSource(db, 20*time.Second)
	found, err := source.Runs(ctx, "synthetic-owner")
	if err != nil || len(found) != count {
		t.Fatalf("wanted all %d synthetic runs, got %d: %v", count, len(found), err)
	}
	for n, row := range found {
		if row[0].Value != fmt.Sprintf("archive-%03d", n) {
			t.Fatalf("non-deterministic order at %d", n)
		}
		for _, elem := range row {
			if elem.Key == "owner" && elem.Value != "synthetic-owner" {
				t.Fatal("cross-owner save leaked")
			}
		}
	}
	target := fakeRuns{}
	result, err := Import(
		ctx, source, target, chroniclesprogression.NewMemory(),
		"synthetic-owner", time.Now(),
	)
	if err != nil || result.RunsFound != count || result.RunsImported != count || len(target) != count {
		t.Fatalf("incomplete migration: result=%+v target=%d err=%v", result, len(target), err)
	}
	repeated, err := Import(
		ctx, source, target, chroniclesprogression.NewMemory(),
		"synthetic-owner", time.Now(),
	)
	if err != nil || repeated.RunsFound != count || repeated.RunsKept != count || repeated.RunsImported != 0 {
		t.Fatalf("non-idempotent replay: result=%+v err=%v", repeated, err)
	}
}
