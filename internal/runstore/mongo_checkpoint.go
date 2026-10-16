package runstore

import (
 "context"
 "errors"

 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
)

// MongoCheckpointWriter provides the first isolated write primitive. It is
// intentionally NOT wired to HTTP routes or production configuration.
// Collection must be injected by staging setup; never select a live database
// implicitly. Existing legacy documents are not modified by this component
// until a migration-compatible state mapping has been established.
type MongoCheckpointWriter struct { Collection *mongo.Collection }

func checkpointFilter(ownerID, runID string, version int64) bson.D {
 return bson.D{
  {Key:"_id",Value:runID},
  {Key:"owner",Value:ownerID},
  {Key:"worldVersion",Value:version},
  {Key:"status",Value:"active"},
 }
}

// Checkpoint performs one atomic owner-scoped compare-and-swap. A successful
// retry with an old version is a conflict, never an accidental second write.
// Full legacy terminal replay and monotonic reward semantics must be added
// before any endpoint uses this primitive.
func (w MongoCheckpointWriter) Checkpoint(ctx context.Context, ownerID, runID string, expectedVersion int64, key string, state []byte) (Run,error) {
 if err:=ValidateCheckpointBoundary(ownerID,runID,expectedVersion,key,state);err!=nil {return Run{},err}
 if w.Collection==nil {return Run{},ErrUnavailable}
 filter:=checkpointFilter(ownerID,runID,expectedVersion)
 update:=bson.D{{Key:"$set",Value:bson.D{{Key:"state",Value:string(state)}}},{Key:"$inc",Value:bson.D{{Key:"worldVersion",Value:int64(1)}}}}
 result,err:=w.Collection.UpdateOne(ctx,filter,update)
 if err!=nil {return Run{},errors.Join(ErrUnavailable,err)}
 if result.MatchedCount!=1 {return Run{},ErrConflict}
 return Run{ID:runID,OwnerID:ownerID,WorldVersion:expectedVersion+1,State:append([]byte(nil),state...)},nil
}
