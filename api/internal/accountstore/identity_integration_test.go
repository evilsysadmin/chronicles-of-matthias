package accountstore

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestCentralIdentityProfilesPreserveLegacyOwnershipAndInitializeOnce(t *testing.T) {
	uri := os.Getenv("IDENTITY_PROFILE_TEST_MONGO_URL")
	if uri == "" {
		t.Skip("explicit ephemeral local Mongo profile fixture not configured")
	}
	if uri != "mongodb://127.0.0.1:27017" {
		t.Fatal("refusing non-local Mongo profile fixture")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	db := client.Database("chronicles_identity_profile_test")
	if err := db.Drop(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_ = db.Drop(cleanup)
		_ = client.Disconnect(cleanup)
	})
	s := New(db, 2*time.Second)
	const subject = "11111111-1111-4111-8111-111111111111"
	key := identityauth.ProfilePrefix + subject
	_, err = db.Collection("users").InsertMany(ctx, []any{
		bson.M{"_id": "alice", "password_hash": "legacy-fixture-hash", "saved_marker": "legacy-owned"},
		bson.M{"_id": key, "password_hash": "preclaimed-fixture-hash", "saved_marker": "collision-owned"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if profile, err := s.EnsureIdentityUser(ctx, identityauth.Issuer, subject, "fixture-time"); err == nil || profile != "" {
		t.Fatal("adopted unbound local profile")
	}
	var row bson.M
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": key}).Decode(&row); err != nil || row["saved_marker"] != "collision-owned" || row["password_hash"] != "preclaimed-fixture-hash" || row["sso_issuer"] != nil {
		t.Fatal("collision changed an existing user's data", err)
	}
	const other = "22222222-2222-4222-8222-222222222222"
	var group sync.WaitGroup
	results := make(chan error, 12)
	for range 12 {
		group.Go(func() {
			profile, err := s.EnsureIdentityUser(ctx, identityauth.Issuer, other, "fixture-time")
			if err == nil && profile != identityauth.ProfilePrefix+other {
				t.Error("profile identity changed")
			}
			results <- err
		})
	}
	group.Wait()
	close(results)
	for err := range results {
		if err != nil {
			t.Fatal("concurrent idempotent profile creation failed", err)
		}
	}
	if count, err := db.Collection("users").CountDocuments(ctx, bson.D{}); err != nil || count != 3 {
		t.Fatal("created repeated identity accounts/profiles", err)
	}
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": identityauth.ProfilePrefix + other}).Decode(&row); err != nil || row["sso_issuer"] != identityauth.Issuer || row["sso_subject"] != other || row["password_hash"] != "" {
		t.Fatal("local profile retained a password or lost its immutable binding", err)
	}
	if _, err := s.EnsureIdentityUser(ctx, "https://id.shadowops.dpdns.org", other, "fixture-time"); err == nil {
		t.Fatal("production identity bound to staging profile")
	}
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": "alice"}).Decode(&row); err != nil || row["saved_marker"] != "legacy-owned" {
		t.Fatal("legacy user data changed", err)
	}
}
