package accountstore

import (
	"context"
	"errors"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var ErrIdentityNamespaceConflict = errors.New("central Identity namespace ownership conflict")
var ErrIdentityNamespaceUnavailable = errors.New("central Identity namespace preflight unavailable")

// CheckIdentityNamespace is read-only. The opt-in runtime must refuse legacy
// reservations/corrupt bindings before accepting any central Identity request.
// Existing correctly bound passwordless profiles remain valid after restart.
func (s *Store) CheckIdentityNamespace(ctx context.Context) error {
	if s == nil || s.users == nil || ctx == nil || ctx.Err() != nil {
		return ErrIdentityNamespaceUnavailable
	}
	queryCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	cursor, err := s.users.Find(queryCtx, bson.M{"_id": bson.Regex{Pattern: "^shadowops:", Options: "i"}},
		options.Find().SetProjection(bson.M{"_id": 1, "sso": 1, "sso_issuer": 1, "sso_subject": 1, "password_hash": 1}))
	if err != nil {
		return ErrIdentityNamespaceUnavailable
	}
	defer cursor.Close(queryCtx)
	for cursor.Next(queryCtx) {
		var row struct {
			Key      string  `bson:"_id"`
			SSO      bool    `bson:"sso"`
			Issuer   string  `bson:"sso_issuer"`
			Subject  string  `bson:"sso_subject"`
			Password *string `bson:"password_hash"`
		}
		if cursor.Decode(&row) != nil {
			return ErrIdentityNamespaceConflict
		}
		subject, valid := identityauth.SubjectForProfileKey(row.Key)
		if !valid || !row.SSO || row.Issuer != identityauth.Issuer || row.Subject != subject || row.Password == nil || *row.Password != "" {
			return ErrIdentityNamespaceConflict
		}
	}
	if cursor.Err() != nil {
		return ErrIdentityNamespaceUnavailable
	}
	return nil
}
