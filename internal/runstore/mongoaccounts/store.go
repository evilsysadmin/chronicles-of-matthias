// Package mongoaccounts reads the legacy Chess Studio account session
// revision without importing Chess Studio or copying password hashes.
package mongoaccounts

import (
 "context"
 "errors"
 "strings"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/sessionverify"
 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
 "go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
 ErrUnconfigured = errors.New("account collection not configured")
 ErrInvalidAccount = errors.New("invalid account session record")
)

type Store struct {
 users *mongo.Collection
}

// New only accepts an explicitly selected database. The eventual release
// plan must decide where migrated user identities live; this module must
// not silently query Chess Studio's production users database.
func New(database *mongo.Database)(*Store,error) {
 if database==nil {return nil,ErrUnconfigured}
 return &Store{users:database.Collection("users")},nil
}

var _ sessionverify.Accounts = (*Store)(nil)

// CurrentSession mirrors the existing users collection's _id and
// session_version fields; missing/null session_version means legacy zero.
// Malformed or negative versions fail closed rather than silently resetting.
func (s *Store) CurrentSession(ctx context.Context, username string)(int64,bool,error) {
 if s==nil||s.users==nil{return 0,false,ErrUnconfigured}
 if strings.TrimSpace(username)=="" {return 0,false,ErrInvalidAccount}
 queryCtx,cancel:=context.WithTimeout(ctx,2*time.Second)
 defer cancel()
 var row bson.M
 err:=s.users.FindOne(queryCtx,bson.M{"_id":username},
  options.FindOne().SetProjection(bson.M{"_id":1,"session_version":1})).Decode(&row)
 if errors.Is(err,mongo.ErrNoDocuments){return 0,false,nil}
 if err!=nil{return 0,false,err}
 raw,exists:=row["session_version"]
 if !exists||raw==nil {return 0,true,nil}
 var version int64
 switch v:=raw.(type){
 case int32:version=int64(v)
 case int64:version=v
 case int:version=int64(v)
 default:return 0,false,ErrInvalidAccount
 }
 if version<0{return 0,false,ErrInvalidAccount}
 return version,true,nil
}
