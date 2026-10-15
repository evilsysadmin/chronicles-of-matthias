package mongoruns

import (
 "context"
 "errors"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/legacyread"
 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
)

// GetPublic is the read-only, full legacy save retrieval boundary.
//
// ownerID MUST come from validated server-side authentication; never derive it
// from a user-controlled URL, query parameter or header. There is deliberately
// no public HTTP route until that authentication adapter is implemented.
func (r *Reader) GetPublic(ctx context.Context, ownerID, runID string) (legacyread.PublicRun, error) {
 var empty legacyread.PublicRun
 if err:=validateScope(ownerID,runID);err!=nil{return empty,err}
 if runID=="" {return empty,ErrInvalidScope}
 readCtx,cancel:=context.WithTimeout(ctx,3*time.Second)
 defer cancel()
 var row bson.D
 err:=r.runs.FindOne(readCtx,bson.D{
  {Key:"_id",Value:runID},
  {Key:"owner",Value:ownerID},
 }).Decode(&row)
 if errors.Is(err,mongo.ErrNoDocuments){return empty,runstore.ErrNotFound}
 if err!=nil{return empty,runstore.ErrUnavailable}
 return legacyread.Public(row)
}
