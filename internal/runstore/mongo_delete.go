package runstore

import (
    "context"
    "errors"
    "strings"

    "go.mongodb.org/mongo-driver/v2/bson"
    "go.mongodb.org/mongo-driver/v2/mongo"
)

// MongoDeleteWriter is a staging-only, injected primitive. No HTTP endpoint,
// implicit database selection, or production write enablement is added here.
type MongoDeleteWriter struct { Collection *mongo.Collection }

// Delete removes exactly one run belonging to the authenticated owner.
// Missing and foreign run IDs are deliberately indistinguishable (false, nil).
// Mongo failures fail closed. Run IDs are never accepted from an owner header.
func (w MongoDeleteWriter) Delete(ctx context.Context, ownerID, runID string) (bool, error) {
    if strings.TrimSpace(ownerID) == "" || strings.TrimSpace(runID) == "" {
        return false, ErrInvalidWrite
    }
    if w.Collection == nil {
        return false, ErrUnavailable
    }
    result, err := w.Collection.DeleteOne(ctx, bson.D{
        {Key: "_id", Value: runID},
        {Key: "owner", Value: ownerID},
    })
    if err != nil {
        return false, errors.Join(ErrUnavailable, err)
    }
    return result.DeletedCount == 1, nil
}
