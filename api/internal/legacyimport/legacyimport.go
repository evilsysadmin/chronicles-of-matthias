// Package legacyimport brings one player's Chronicles data over from Chess
// Studio's staging database, where the game lived before it had its own API.
//
// It copies the player's saved runs and hero progression into Chronicles'
// own database. It never overwrites: a run already present is kept, and a
// progression already present wins unless the legacy one has more total XP.
// Accounts are matched by username, which both databases use as the owner.
package legacyimport

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
)

// SourceDatabase is Chess Studio's staging database on the same cluster.
const SourceDatabase = "chess_study_staging"

const (
	runsCollection    = "chronicles_runs"
	profileCollection = "profile"
	progressionKey    = "chess-study-chronicles-progression-v1"
	runBatchSize      = 200 // network batches, never a per-owner document limit
)

var ErrUnavailable = errors.New("legacy import storage unavailable")

// Error says which side failed and how, without leaking connection details,
// so an operator can tell a missing permission from an outage.
type Error struct {
	Stage  string // "read-legacy-runs", "read-legacy-profile", "write-runs", "progression"
	Reason string // "unauthorized", "timeout" or "unavailable"
}

func (e *Error) Error() string { return "legacy import failed at " + e.Stage + ": " + e.Reason }

func fail(stage string, err error) error {
	reason := "unavailable"
	var server mongo.ServerError
	switch {
	case errors.As(err, &server) && (server.HasErrorCode(13) || server.HasErrorCode(8000)):
		reason = "unauthorized"
	case mongo.IsTimeout(err) || errors.Is(err, context.DeadlineExceeded):
		reason = "timeout"
	case mongo.IsDuplicateKeyError(err):
		reason = "conflict"
	}
	return &Error{Stage: stage, Reason: reason}
}

// ValidateDistinctDatabases prevents an operator import from treating the
// target game's own database as an archive. Otherwise every existing target
// run could be reported as successfully "kept" despite no real migration.
// This validation happens only upon the staging-only import operation, not
// during API startup, and never exposes credentials or Mongo connection URIs.
func ValidateDistinctDatabases(source, target string) error {
	from, to := strings.TrimSpace(source), strings.TrimSpace(target)
	// The staging-only importer may read Chess Studio staging but must never
	// write into either Chess Studio environment, even if accidentally
	// configured as the independent game's target database.
	if from != SourceDatabase || to == "" || to == SourceDatabase || to == "chess_study" {
		return &Error{Stage: "validate-source", Reason: "invalid"}
	}
	return nil
}

// Source reads the legacy data.
type Source interface {
	Runs(ctx context.Context, owner string) ([]bson.D, error)
	// Progression is the stored JSON, or "" when the player has none.
	Progression(ctx context.Context, owner string) (string, error)
}

// RunTarget stores a run unless one with the same id already exists.
type RunTarget interface {
	InsertIfAbsent(ctx context.Context, run bson.D) (bool, error)
}

// Result reports what happened; Progression is "imported", "kept" or "none".
type Result struct {
	RunsFound    int    `json:"runsFound"`
	RunsImported int    `json:"runsImported"`
	RunsKept     int    `json:"runsKept"`
	Progression  string `json:"progression"`
}

// legacyIdentity rejects ambiguous/malformed IDs and owners without ever
// including identifying values in a returned error or operator log.
var errLegacyIdentity = errors.New("invalid legacy run identity")

func legacyIdentity(row bson.D) (string, string, error) {
	var id, owner string
	var haveID, haveOwner bool
	for _, element := range row {
		switch element.Key {
		case "_id":
			if haveID {
				return "", "", errLegacyIdentity
			}
			haveID = true
			id, _ = element.Value.(string)
		case "owner":
			if haveOwner {
				return "", "", errLegacyIdentity
			}
			haveOwner = true
			owner, _ = element.Value.(string)
		}
	}
	if !haveID || !haveOwner || strings.TrimSpace(id) == "" || strings.TrimSpace(owner) == "" {
		return "", "", errLegacyIdentity
	}
	return id, owner, nil
}

// Validate the ENTIRE source before making the first destination mutation.
// A foreign-owned record, malformed ID, or duplicate source ID must not
// result in a partial copy with a misleading success count.
func validateOwnerRuns(rows []bson.D, owner string) error {
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		id, actualOwner, err := legacyIdentity(row)
		if err != nil || actualOwner != owner {
			return &Error{Stage: "validate-legacy-runs", Reason: "invalid"}
		}
		if _, duplicated := seen[id]; duplicated {
			return &Error{Stage: "validate-legacy-runs", Reason: "invalid"}
		}
		seen[id] = struct{}{}
	}
	return nil
}

func Import(ctx context.Context, src Source, runs RunTarget, progression chroniclesprogression.Store, owner string, now time.Time) (Result, error) {
	var result Result
	legacyRuns, err := src.Runs(ctx, owner)
	if err != nil {
		return Result{}, fail("read-legacy-runs", err)
	}
	result.RunsFound = len(legacyRuns)
	if err := validateOwnerRuns(legacyRuns, owner); err != nil {
		return Result{}, err
	}
	for _, run := range legacyRuns {
		inserted, err := runs.InsertIfAbsent(ctx, run)
		if err != nil {
			return Result{}, fail("write-runs", err)
		}
		if inserted {
			result.RunsImported++
		} else {
			result.RunsKept++
		}
	}

	legacy, err := src.Progression(ctx, owner)
	if err != nil {
		return Result{}, fail("read-legacy-profile", err)
	}
	if legacy == "" || len(legacy) > chroniclesprogression.MaxDocumentBytes || !isObject(legacy) {
		result.Progression = "none"
		return result, nil
	}
	current, err := progression.Get(ctx, owner)
	if err != nil {
		return Result{}, fail("progression", err)
	}
	if current.Revision > 0 && TotalXP(current.Document) >= TotalXP(legacy) {
		result.Progression = "kept"
		return result, nil
	}
	if _, err := progression.Put(ctx, owner, legacy, current.Revision, now); err != nil {
		return Result{}, fail("progression", err)
	}
	result.Progression = "imported"
	return result, nil
}

func isObject(raw string) bool {
	var value map[string]any
	return json.Unmarshal([]byte(raw), &value) == nil && value != nil
}

// TotalXP sums the heroes' XP, the same measure the client uses to decide
// which of two progressions is more advanced.
func TotalXP(raw string) float64 {
	var doc struct {
		Heroes map[string]struct {
			XP float64 `json:"xp"`
		} `json:"heroes"`
	}
	if json.Unmarshal([]byte(raw), &doc) != nil {
		return 0
	}
	total := 0.0
	for _, hero := range doc.Heroes {
		if hero.XP > 0 {
			total += hero.XP
		}
	}
	return total
}

// MongoSource reads Chess Studio's database.
type MongoSource struct {
	db      *mongo.Database
	timeout time.Duration
}

func NewMongoSource(db *mongo.Database, timeout time.Duration) *MongoSource {
	return &MongoSource{db: db, timeout: timeout}
}

// runCursor keeps the read loop independently testable. Mongo fetches bounded
// network batches, but the importer must scan EVERY run owned by the player.
type runCursor interface {
	Next(context.Context) bool
	Decode(any) error
	Err() error
}

func readRunCursor(ctx context.Context, cursor runCursor) ([]bson.D, error) {
	rows := make([]bson.D, 0)
	for cursor.Next(ctx) {
		var row bson.D
		if err := cursor.Decode(&row); err != nil {
			return nil, err // Never report a partial source scan as complete.
		}
		rows = append(rows, row)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *MongoSource) Runs(ctx context.Context, owner string) ([]bson.D, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	// BatchSize is not Limit: the cursor continues until the owner's entire
	// archive has been read. Deterministic ordering helps operational audits.
	cursor, err := s.db.Collection(runsCollection).Find(
		ctx, bson.D{{Key: "owner", Value: owner}},
		options.Find().SetBatchSize(runBatchSize).SetSort(bson.D{{Key: "_id", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	return readRunCursor(ctx, cursor)
}

func (s *MongoSource) Progression(ctx context.Context, owner string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	var row struct {
		Data bson.M `bson:"data"`
	}
	err := s.db.Collection(profileCollection).FindOne(ctx, bson.D{{Key: "_id", Value: owner}}).Decode(&row)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	switch value := row.Data[progressionKey].(type) {
	case nil:
		return "", nil
	case string:
		return value, nil
	default:
		// Stored as a document rather than a JSON string: render it as JSON.
		raw, err := bson.MarshalExtJSON(bson.M{"v": value}, false, false)
		if err != nil {
			return "", err
		}
		var wrapped struct {
			V json.RawMessage `json:"v"`
		}
		if json.Unmarshal(raw, &wrapped) != nil {
			return "", nil
		}
		return string(wrapped.V), nil
	}
}

// MongoRuns writes into Chronicles' own runs collection.
type MongoRuns struct {
	col     *mongo.Collection
	timeout time.Duration
}

func NewMongoRuns(db *mongo.Database, timeout time.Duration) *MongoRuns {
	return &MongoRuns{col: db.Collection(runsCollection), timeout: timeout}
}

func (t *MongoRuns) InsertIfAbsent(ctx context.Context, run bson.D) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, t.timeout)
	defer cancel()
	id, owner, err := legacyIdentity(run)
	if err != nil {
		return false, err
	}
	rest := bson.D{}
	for _, field := range run {
		if field.Key != "_id" {
			rest = append(rest, field)
		}
	}
	// Match both identity AND owner. Upsert by _id alone could report a
	// different player's save as "kept" and silently lose this player's run.
	// A conflicting existing _id now produces Mongo duplicate-key (E11000).
	result, err := t.col.UpdateOne(ctx,
		bson.D{{Key: "_id", Value: id}, {Key: "owner", Value: owner}},
		bson.D{{Key: "$setOnInsert", Value: rest}}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return false, err
	}
	return result.UpsertedCount == 1, nil
}
