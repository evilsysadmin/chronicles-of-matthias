package legacyimport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesrun"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/gamesapi"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/sessionauth"
)

// Both users exist in this synthetic API account registry. Their signed,
// different session tokens must never cross each other's saved runs.
type restoreTestAccounts struct{}

func (restoreTestAccounts) AuthState(_ context.Context, username string) (bool, int64, error) {
	return username == "archived-player" || username == "different-player", 0, nil
}

// A real two-database migration drill against disposable CI Mongo only.
// Proves imported checkpoints remain readable and mutable through the
// independent game's *real* run store, not merely through raw Mongo queries.
// It does not certify real historical source coverage or frontend gameplay.
func TestImportedLegacyRunCanBeResumedByItsOwner(t *testing.T) {
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

	tag := fmt.Sprintf("legacy_resume_%d", time.Now().UnixNano())
	sourceDB := client.Database(tag + "_source")
	targetDB := client.Database(tag + "_target")
	defer sourceDB.Drop(context.Background())
	defer targetDB.Drop(context.Background())

	created := bson.NewDateTimeFromTime(time.Unix(1_700_000_000, 0).UTC())
	sourceSave := bson.D{
		{Key: "_id", Value: "synthetic-legacy-save"},
		{Key: "owner", Value: "archived-player"},
		{Key: "seed", Value: int64(42)},
		{Key: "currentMapId", Value: "synthetic-map"},
		{Key: "contentVersion", Value: int64(1)},
		{Key: "manifestRevision", Value: "synthetic-revision"},
		{Key: "status", Value: "active"},
		{Key: "worldVersion", Value: int64(2)},
		{Key: "worldFlags", Value: bson.D{{Key: "torchLit", Value: true}}},
		{Key: "inventory", Value: bson.D{{Key: "gold", Value: int32(75)}}},
		{Key: "quests", Value: bson.D{{Key: "firstQuest", Value: "active"}}},
		{Key: "consumedContentIds", Value: bson.A{}},
		{Key: "claimedRewards", Value: bson.A{}},
		{Key: "createdAt", Value: created},
		{Key: "updatedAt", Value: created},
		{Key: "createFingerprint", Value: "synthetic-fingerprint"},
	}
	if _, err := sourceDB.Collection(runsCollection).InsertOne(ctx, sourceSave); err != nil {
		t.Fatal(err)
	}
	src := NewMongoSource(sourceDB, 10*time.Second)
	target := NewMongoRuns(targetDB, 10*time.Second)
	progression := chroniclesprogression.NewMemory()
	imported, err := Import(ctx, src, target, progression, "archived-player", time.Now())
	if err != nil || imported.RunsFound != 1 || imported.RunsImported != 1 {
		t.Fatalf("complete source archive not imported: %+v, %v", imported, err)
	}
	gameStore := chroniclesrun.NewMongo(targetDB, 10*time.Second)

	// The game store's owner-bound read exposes the imported checkpoint.
	saved, err := gameStore.Get(ctx, "synthetic-legacy-save", "archived-player")
	if err != nil || saved == nil {
		t.Fatalf("owner cannot resume imported save: %v", err)
	}
	encoded, err := bson.Marshal(saved)
	if err != nil {
		t.Fatal(err)
	}
	row := bson.Raw(encoded)
	if row.Lookup("runId").StringValue() != "synthetic-legacy-save" ||
		row.Lookup("currentMapId").StringValue() != "synthetic-map" ||
		row.Lookup("inventory", "gold").Int32() != 75 ||
		row.Lookup("quests", "firstQuest").StringValue() != "active" {
		t.Fatal("imported save lost checkpoint fields on owner-bound read")
	}
	denied, err := gameStore.Get(ctx, "synthetic-legacy-save", "different-player")
	if err != nil || denied != nil {
		t.Fatalf("foreign player can see imported save: %v", err)
	}
	ownList, err := gameStore.ListActive(ctx, "archived-player", 10)
	if err != nil || len(ownList) != 1 {
		t.Fatalf("imported active save missing from owner's resume list: %v", err)
	}
	foreignList, err := gameStore.ListActive(ctx, "different-player", 10)
	if err != nil || len(foreignList) != 0 {
		t.Fatalf("foreign player can list imported save: %v", err)
	}

	// Exercise the real authenticated HTTP route, not just raw Mongo owner
	// filters. Two valid signed sessions must see different results.
	const jwtSecret = "synthetic-tests-only-auth-secret"
	api, err := gamesapi.NewChroniclesRuns(gamesapi.ChroniclesRunsConfig{
		Config: gamesapi.Config{
			Accounts: restoreTestAccounts{},
			JWTSecret: jwtSecret,
		},
		Runs: gameStore,
	})
	if err != nil {
		t.Fatal(err)
	}
	getToken := func(username string) string {
		t.Helper()
		token, err := sessionauth.Sign(username, 0, []byte(jwtSecret), time.Now())
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	call := func(path, token string) (int, map[string]any) {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet, path, nil)
		if token != "" {
			request.Header.Set("Authorization", "Bearer "+token)
		}
		recorder := httptest.NewRecorder()
		api.ServeHTTP(recorder, request)
		reply := map[string]any{}
		if err := json.Unmarshal(recorder.Body.Bytes(), &reply); err != nil {
			t.Fatalf("invalid API JSON (HTTP %d): %v", recorder.Code, err)
		}
		return recorder.Code, reply
	}
	path := "/api/chronicles/runs/synthetic-legacy-save"
	ownerToken := getToken("archived-player")
	foreignToken := getToken("different-player")
	if status, _ := call(path, ""); status != http.StatusUnauthorized {
		t.Fatalf("unauthenticated archived save HTTP=%d", status)
	}
	if status, _ := call(path, foreignToken); status != http.StatusNotFound {
		t.Fatalf("cross-account archived save HTTP=%d", status)
	}
	if status, reply := call(path, ownerToken); status != http.StatusOK ||
		reply["runId"] != "synthetic-legacy-save" || reply["currentMapId"] != "synthetic-map" {
		t.Fatalf("authenticated owner cannot resume imported save: HTTP=%d", status)
	}
	for _, tc := range []struct {
		token string
		want  int
	}{
		{ownerToken, 1},
		{foreignToken, 0},
	} {
		status, reply := call("/api/chronicles/runs", tc.token)
		runs, ok := reply["runs"].([]any)
		if status != http.StatusOK || !ok || len(runs) != tc.want {
			t.Fatalf("authenticated owner-scoped list returned HTTP=%d, want %d saves", status, tc.want)
		}
	}

	// A true recovery must also allow a checkpoint, not only read raw JSON.
	checkpointed, err := gameStore.Checkpoint(ctx, chroniclesrun.Checkpoint{
		RunID: "synthetic-legacy-save", Owner: "archived-player",
		MapID: "synthetic-map", ManifestRevision: "synthetic-revision",
		ExpectedWorldVersion: 2, ContentVersion: 1,
		WorldFlags: bson.D{{Key: "torchLit", Value: true}},
		Inventory: bson.D{{Key: "gold", Value: int32(76)}},
		Quests: bson.D{{Key: "firstQuest", Value: "active"}},
		Now: time.Now(),
	})
	if err != nil || checkpointed == nil {
		t.Fatalf("owner cannot checkpoint imported save: %v", err)
	}
	after, err := gameStore.Get(ctx, "synthetic-legacy-save", "archived-player")
	if err != nil || after == nil {
		t.Fatalf("checkpoint not readable after import: %v", err)
	}
	afterRaw, err := bson.Marshal(after)
	if err != nil {
		t.Fatal(err)
	}
	if bson.Raw(afterRaw).Lookup("inventory", "gold").Int32() != 76 {
		t.Fatal("checkpoint after import did not persist the new inventory")
	}

	// Re-import must not overwrite the more recent checkpoint.
	again, err := Import(ctx, src, target, progression, "archived-player", time.Now())
	if err != nil || again.RunsFound != 1 || again.RunsKept != 1 || again.RunsImported != 0 {
		t.Fatalf("resume-state-preserving reimport failed: %+v, %v", again, err)
	}
	finalSave, err := gameStore.Get(ctx, "synthetic-legacy-save", "archived-player")
	if err != nil || finalSave == nil {
		t.Fatalf("reimport lost the owner's save: %v", err)
	}
	finalRaw, err := bson.Marshal(finalSave)
	if err != nil {
		t.Fatal(err)
	}
	if bson.Raw(finalRaw).Lookup("inventory", "gold").Int32() != 76 {
		t.Fatal("reimport overwrote gameplay progress after recovery")
	}

	var original bson.Raw
	if err := sourceDB.Collection(runsCollection).FindOne(ctx, bson.D{{Key: "_id", Value: "synthetic-legacy-save"}}).Decode(&original); err != nil {
		t.Fatal(err)
	}
	if original.Lookup("inventory", "gold").Int32() != 75 {
		t.Fatal("migration modified the historical source database")
	}
}
