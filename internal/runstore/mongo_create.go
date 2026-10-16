package runstore

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// MongoCreateWriter is a staging-only, injected MongoDB write primitive.
// It is NOT registered as an HTTP route and must not select a database itself.
// The opaque state envelope is not yet compatible with the full legacy schema.
type MongoCreateWriter struct{ Collection *mongo.Collection }

// createFingerprint ties one globally unique run ID to the caller's explicit
// idempotency key and canonical JSON body. Length prefixes prevent separator
// ambiguities; UseNumber preserves large integer precision.
func createFingerprint(runID, key string, state []byte) (string, error) {
	decoder := json.NewDecoder(bytes.NewReader(state))
	decoder.UseNumber()
	var payload any
	if err := decoder.Decode(&payload); err != nil {
		return "", ErrInvalidWrite
	}
	canonical, err := json.Marshal(payload)
	if err != nil {
		return "", ErrInvalidWrite
	}
	h := sha256.New()
	for _, part := range [][]byte{[]byte(runID), []byte(key), canonical} {
		var size [8]byte
		binary.BigEndian.PutUint64(size[:], uint64(len(part)))
		_, _ = h.Write(size[:])
		_, _ = h.Write(part)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

type createdRunDocument struct {
	ID                string `bson:"_id"`
	Owner             string `bson:"owner"`
	WorldVersion      int64  `bson:"worldVersion"`
	Status            string `bson:"status"`
	State             string `bson:"state"`
	CreateFingerprint string `bson:"createFingerprint"`
}

// Create inserts one initial checkpoint. Duplicate _id collisions are replayed
// only when both the authenticated owner and request fingerprint match.
// Existing legacy documents without this fingerprint are never replayed.
// Mongo errors fail closed; no in-memory fallback or player-data migration.
func (w MongoCreateWriter) Create(ctx context.Context, ownerID, idempotencyKey string, run Run) (Run, error) {
	if err := ValidateCreateBoundary(ownerID, idempotencyKey, run); err != nil {
		return Run{}, err
	}
	if w.Collection == nil {
		return Run{}, ErrUnavailable
	}
	fingerprint, err := createFingerprint(run.ID, idempotencyKey, run.State)
	if err != nil {
		return Run{}, err
	}
	doc := createdRunDocument{
		ID: run.ID, Owner: ownerID, WorldVersion: 0,
		Status: "active", State: string(run.State), CreateFingerprint: fingerprint,
	}
	if _, err := w.Collection.InsertOne(ctx, doc); err == nil {
		return Run{ID: run.ID, OwnerID: ownerID, WorldVersion: 0, State: append([]byte(nil), run.State...)}, nil
	} else if !mongo.IsDuplicateKeyError(err) {
		return Run{}, errors.Join(ErrUnavailable, err)
	}

	// A duplicate may be another owner's run. Keep the owner/fingerprint inside
	// the Mongo predicate and return the same conflict for every mismatch.
	var existing createdRunDocument
	filter := bson.D{
		{Key: "_id", Value: run.ID},
		{Key: "owner", Value: ownerID},
		{Key: "createFingerprint", Value: fingerprint},
	}
	if err := w.Collection.FindOne(ctx, filter).Decode(&existing); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return Run{}, ErrConflict
		}
		return Run{}, errors.Join(ErrUnavailable, err)
	}
	return Run{
		ID: existing.ID, OwnerID: ownerID, WorldVersion: existing.WorldVersion,
		State: []byte(existing.State),
	}, nil
}
