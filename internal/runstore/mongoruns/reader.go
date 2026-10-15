// Package mongoruns implements the first read-only MongoDB boundary for Chronicles.
// It is intentionally not connected to the HTTP API until save parity is established.
package mongoruns

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

const collectionName = "chronicles_runs"

var (
	ErrInvalidScope = errors.New("invalid Chronicles run owner or ID")
	ErrConfiguration = errors.New("invalid Chronicles MongoDB configuration")
	databaseName = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
)

// Reader inspects the established Chronicles collection shared by the Python
// API and Chess Studio's native Go implementation. Full checkpoint JSON
// conversion is deliberately deferred until the parity corpus is imported.
type Reader struct {
	client *mongo.Client
	runs *mongo.Collection
}

type document struct {
	RunID string `bson:"_id"`
	OwnerID string `bson:"owner"`
	WorldVersion int64 `bson:"worldVersion"`
	Status string `bson:"status"`
	UpdatedAt bson.DateTime `bson:"updatedAt"`
}

func validateConfiguration(uri, database string) error {
	if strings.TrimSpace(uri) == "" || !databaseName.MatchString(database) {
		return ErrConfiguration
	}
	return nil
}

func validateScope(ownerID, runID string) error {
	if strings.TrimSpace(ownerID) == "" || (runID != "" && strings.TrimSpace(runID) == "") {
		return ErrInvalidScope
	}
	return nil
}

// Open establishes the connection and a non-unique index for owner-scoped
// active-run summaries. The existing _id unique index governs run identity.
// It does NOT enable HTTP routes or migrate existing Python/Go saves.
func Open(ctx context.Context, uri, database string) (*Reader, error) {
	if err := validateConfiguration(uri, database); err != nil {
		return nil, err
	}
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(3*time.Second))
	if err != nil {
		return nil, fmt.Errorf("%w: connection setup", runstore.ErrUnavailable)
	}
	cleanup := func() { _ = client.Disconnect(context.Background()) }
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(checkCtx, readpref.Primary()); err != nil {
		cleanup()
		return nil, fmt.Errorf("%w: connection ping", runstore.ErrUnavailable)
	}
	r := &Reader{client: client, runs: client.Database(database).Collection(collectionName)}
	if _, err := r.runs.Indexes().CreateOne(checkCtx, mongo.IndexModel{
		Keys: bson.D{{Key: "owner", Value: 1}, {Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}},
	}); err != nil {
		cleanup()
		return nil, fmt.Errorf("%w: index creation", runstore.ErrUnavailable)
	}
	return r, nil
}

func (r *Reader) Close(ctx context.Context) error {
	return r.client.Disconnect(ctx)
}

func (r *Reader) Ping(ctx context.Context) error {
	if err := r.client.Ping(ctx, readpref.Primary()); err != nil {
		return runstore.ErrUnavailable
	}
	return nil
}

func (d document) run() runstore.Run {
	return runstore.Run{
		ID: d.RunID, OwnerID: d.OwnerID, WorldVersion: d.WorldVersion,
		// State is nil until the full persisted checkpoint contract is ported.
	}
}

// Get is always filtered by both authenticated owner and run ID.
func (r *Reader) Get(ctx context.Context, ownerID, runID string) (runstore.Run, error) {
	if err := validateScope(ownerID, runID); err != nil { return runstore.Run{}, err }
	if runID == "" { return runstore.Run{}, ErrInvalidScope }
	var d document
	err := r.runs.FindOne(ctx, bson.M{"owner": ownerID, "_id": runID}).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) { return runstore.Run{}, runstore.ErrNotFound }
	if err != nil { return runstore.Run{}, runstore.ErrUnavailable }
	return d.run(), nil
}

// List is scoped to one authenticated owner and never performs a full scan.
func (r *Reader) List(ctx context.Context, ownerID string) ([]runstore.Run, error) {
	if err := validateScope(ownerID, ""); err != nil { return nil, err }
	cursor, err := r.runs.Find(ctx, bson.M{
		"owner": ownerID,
		"$or": bson.A{
			bson.M{"status": "active"},
			bson.M{"status": bson.M{"$exists": false}},
		},
	}, options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}}).
		SetLimit(30).
		SetProjection(bson.D{
			{Key: "_id", Value: 1},
			{Key: "owner", Value: 1},
			{Key: "worldVersion", Value: 1},
			{Key: "updatedAt", Value: 1},
			{Key: "status", Value: 1},
		}))
	if err != nil { return nil, runstore.ErrUnavailable }
	defer cursor.Close(ctx)
	var records []document
	if err := cursor.All(ctx, &records); err != nil { return nil, runstore.ErrUnavailable }
	runs := make([]runstore.Run, 0, len(records))
	for _, d := range records { runs = append(runs, d.run()) }
	return runs, nil
}
