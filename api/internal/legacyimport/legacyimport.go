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
	maxRuns           = 200
)

var ErrUnavailable = errors.New("legacy import storage unavailable")

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
	RunsImported int    `json:"runsImported"`
	RunsKept     int    `json:"runsKept"`
	Progression  string `json:"progression"`
}

func Import(ctx context.Context, src Source, runs RunTarget, progression chroniclesprogression.Store, owner string, now time.Time) (Result, error) {
	var result Result
	legacyRuns, err := src.Runs(ctx, owner)
	if err != nil {
		return Result{}, ErrUnavailable
	}
	for _, run := range legacyRuns {
		inserted, err := runs.InsertIfAbsent(ctx, run)
		if err != nil {
			return Result{}, ErrUnavailable
		}
		if inserted {
			result.RunsImported++
		} else {
			result.RunsKept++
		}
	}

	legacy, err := src.Progression(ctx, owner)
	if err != nil {
		return Result{}, ErrUnavailable
	}
	if legacy == "" || len(legacy) > chroniclesprogression.MaxDocumentBytes || !isObject(legacy) {
		result.Progression = "none"
		return result, nil
	}
	current, err := progression.Get(ctx, owner)
	if err != nil {
		return Result{}, ErrUnavailable
	}
	if current.Revision > 0 && TotalXP(current.Document) >= TotalXP(legacy) {
		result.Progression = "kept"
		return result, nil
	}
	if _, err := progression.Put(ctx, owner, legacy, current.Revision, now); err != nil {
		return Result{}, err
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

func (s *MongoSource) Runs(ctx context.Context, owner string) ([]bson.D, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	cursor, err := s.db.Collection(runsCollection).Find(ctx, bson.D{{Key: "owner", Value: owner}}, options.Find().SetLimit(maxRuns))
	if err != nil {
		return nil, err
	}
	var rows []bson.D
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
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
	var id any
	rest := bson.D{}
	for _, field := range run {
		if field.Key == "_id" {
			id = field.Value
			continue
		}
		rest = append(rest, field)
	}
	if id == nil {
		return false, nil
	}
	result, err := t.col.UpdateOne(ctx, bson.D{{Key: "_id", Value: id}},
		bson.D{{Key: "$setOnInsert", Value: rest}}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return false, err
	}
	return result.UpsertedCount == 1, nil
}
