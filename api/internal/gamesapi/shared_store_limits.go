package gamesapi

// Shared prerequisites for the active Chronicles handlers, previously defined
// in the unserved Chess Studio CPU-game write handler.
import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/gamestore"
)

// MaxRequestBodyBytes preserves the HTTP body limit used by active endpoints.
const MaxRequestBodyBytes = 1 << 20

// readOnlyStore satisfies the shared Store interface but fails closed: live
// domain handlers must supply their own stores instead of exposing game CRUD.
type readOnlyStore struct{}

func (readOnlyStore) ListSummariesByOwner(context.Context, string, int) ([]gamestore.Summary, error) {
	return nil, gamestore.ErrUnavailable
}

func (readOnlyStore) GetDocumentForOwner(context.Context, string, string) (bson.M, bool, error) {
	return nil, false, gamestore.ErrUnavailable
}

func (readOnlyStore) DeleteForOwner(context.Context, string, string) (bool, error) {
	return false, gamestore.ErrUnavailable
}

var _ Store = readOnlyStore{}
