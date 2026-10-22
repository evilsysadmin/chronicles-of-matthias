package main

// Chronicles owns its feedback collection in its dedicated Mongo database.
// The feedback API handlers (validation, JWT/SSO auth, CORS, rate limits and
// attachment checks) are shared with the existing native gamesapi code.
// This adapter keeps persistence owned by Chronicles, not Chess Studio.
import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const chroniclesFeedbackCollection = "feedback"

type chroniclesFeedbackStore struct {
	col     *mongo.Collection
	timeout time.Duration
}

func newChroniclesFeedbackStore(db *mongo.Database, timeout time.Duration) *chroniclesFeedbackStore {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &chroniclesFeedbackStore{col: db.Collection(chroniclesFeedbackCollection), timeout: timeout}
}

func (s *chroniclesFeedbackStore) Insert(ctx context.Context, doc bson.D) error {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	_, err := s.col.InsertOne(ctx, doc)
	return err
}

func (s *chroniclesFeedbackStore) list(ctx context.Context, filter bson.D, limit int64) ([]bson.D, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	if limit < 1 || limit > 100 {
		limit = 100
	}
	rows, err := s.col.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close(ctx)
	out := make([]bson.D, 0)
	for rows.Next(ctx) {
		var doc bson.D
		if err := rows.Decode(&doc); err != nil {
			return nil, err
		}
		out = append(out, doc)
	}
	return out, rows.Err()
}

func (s *chroniclesFeedbackStore) ListForUser(ctx context.Context, username string, limit int64) ([]bson.D, error) {
	return s.list(ctx, bson.D{{Key: "username", Value: username}}, limit)
}

func (s *chroniclesFeedbackStore) DeleteForUser(ctx context.Context, id, username string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	result, err := s.col.DeleteOne(ctx, bson.D{
		{Key: "_id", Value: id}, {Key: "username", Value: username},
	})
	if err != nil {
		return false, err
	}
	return result.DeletedCount == 1, nil
}

// The admin API uses this same dedicated collection, with admin-only access
// enforced by gamesapi.NewAdminFeedback (not by client-controlled flags).
func (s *chroniclesFeedbackStore) List(ctx context.Context, limit int64) ([]bson.D, error) {
	return s.list(ctx, bson.D{}, limit)
}

func (s *chroniclesFeedbackStore) Summary(ctx context.Context) (newCount, pending int64, err error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	newCount, err = s.col.CountDocuments(ctx, bson.D{{Key: "status", Value: "new"}})
	if err != nil {
		return 0, 0, err
	}
	pending, err = s.col.CountDocuments(ctx, bson.D{{Key: "status", Value: "pending"}})
	if err != nil {
		return 0, 0, err
	}
	return newCount, pending, nil
}

func (s *chroniclesFeedbackStore) Attachments(ctx context.Context, id string) (bson.A, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	var doc struct {
		Attachments bson.A `bson:"attachments"`
	}
	if err := s.col.FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&doc); err != nil {
		if err == mongo.ErrNoDocuments {
			return bson.A{}, nil
		}
		return nil, err
	}
	return doc.Attachments, nil
}

func (s *chroniclesFeedbackStore) Update(ctx context.Context, id string, set bson.D) (bson.D, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	var row bson.D
	err := s.col.FindOneAndUpdate(ctx,
		bson.D{{Key: "_id", Value: id}},
		bson.D{{Key: "$set", Value: set}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&row)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return row, err
}

func (s *chroniclesFeedbackStore) Delete(ctx context.Context, id string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	result, err := s.col.DeleteOne(ctx, bson.D{{Key: "_id", Value: id}})
	if err != nil {
		return false, err
	}
	return result.DeletedCount == 1, nil
}
