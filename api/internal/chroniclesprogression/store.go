// Package chroniclesprogression keeps each player's Chronicles progression
// (character build, XP, attributes) on the server, so it follows the account
// across devices instead of living in one browser.
//
// The document is opaque JSON validated by the client's own normaliser; the
// store only guards size and concurrency (a revision per account).
package chroniclesprogression

import (
	"context"
	"errors"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const CollectionName = "chronicles_progression"

// MaxDocumentBytes bounds one account's progression.
const MaxDocumentBytes = 64 * 1024

var (
	ErrUnavailable = errors.New("chronicles progression store unavailable")
	ErrConflict    = errors.New("chronicles progression changed elsewhere")
)

// Record is the stored progression and its revision (0 when none exists).
type Record struct {
	Document string
	Revision int64
}

type Store interface {
	Get(ctx context.Context, username string) (Record, error)
	// Put writes doc when the stored revision is still baseRevision and
	// returns the new revision; ErrConflict otherwise.
	Put(ctx context.Context, username, doc string, baseRevision int64, now time.Time) (int64, error)
}

// Mongo is the production store.
type Mongo struct {
	col     *mongo.Collection
	timeout time.Duration
}

func NewMongo(db *mongo.Database, timeout time.Duration) *Mongo {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Mongo{col: db.Collection(CollectionName), timeout: timeout}
}

func (s *Mongo) Get(ctx context.Context, username string) (Record, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	var row struct {
		Document string `bson:"document"`
		Revision int64  `bson:"revision"`
	}
	err := s.col.FindOne(ctx, bson.D{{Key: "_id", Value: username}}).Decode(&row)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Record{}, nil
	}
	if err != nil {
		return Record{}, ErrUnavailable
	}
	return Record{Document: row.Document, Revision: row.Revision}, nil
}

func (s *Mongo) Put(ctx context.Context, username, doc string, baseRevision int64, now time.Time) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	next := baseRevision + 1
	set := bson.D{{Key: "$set", Value: bson.D{
		{Key: "document", Value: doc}, {Key: "revision", Value: next}, {Key: "updatedAt", Value: bson.NewDateTimeFromTime(now)},
	}}}
	if baseRevision == 0 {
		_, err := s.col.InsertOne(ctx, bson.D{
			{Key: "_id", Value: username}, {Key: "document", Value: doc}, {Key: "revision", Value: next},
			{Key: "updatedAt", Value: bson.NewDateTimeFromTime(now)},
		})
		if mongo.IsDuplicateKeyError(err) {
			return 0, ErrConflict
		}
		if err != nil {
			return 0, ErrUnavailable
		}
		return next, nil
	}
	result, err := s.col.UpdateOne(ctx, bson.D{{Key: "_id", Value: username}, {Key: "revision", Value: baseRevision}}, set, options.UpdateOne())
	if err != nil {
		return 0, ErrUnavailable
	}
	if result.MatchedCount == 0 {
		return 0, ErrConflict
	}
	return next, nil
}

// Memory is an in-process Store for tests.
type Memory struct {
	mu   sync.Mutex
	rows map[string]Record
}

func NewMemory() *Memory { return &Memory{rows: map[string]Record{}} }

func (m *Memory) Get(_ context.Context, username string) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rows[username], nil
}

func (m *Memory) Put(_ context.Context, username, doc string, baseRevision int64, _ time.Time) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.rows[username].Revision != baseRevision {
		return 0, ErrConflict
	}
	next := baseRevision + 1
	m.rows[username] = Record{Document: doc, Revision: next}
	return next, nil
}
