package runstore

import (
 "testing"

 "go.mongodb.org/mongo-driver/v2/bson"
)

func TestCheckpointFilterAlwaysScopesOwnerAndVersion(t *testing.T) {
 f:=checkpointFilter("alice","run-42",7)
 want:=map[string]any{"_id":"run-42","owner":"alice","worldVersion":int64(7),"status":"active"}
 if len(f)!=len(want){t.Fatalf("unexpected filter: %v",f)}
 for _,entry:=range f {
  if want[entry.Key]!=entry.Value {t.Fatalf("unexpected %s=%v",entry.Key,entry.Value)}
  delete(want,entry.Key)
 }
 if len(want)!=0 {t.Fatal("missing required predicates")}
}
func TestNilMongoWriterFailsClosed(t *testing.T) {
 w:=MongoCheckpointWriter{}
 _,err:=w.Checkpoint(t.Context(),"alice","run-42",0,"key",[]byte(`{"quests":{}}`))
 if err!=ErrUnavailable {t.Fatalf("want unavailable, got %v",err)}
}
var _ = bson.D{}
