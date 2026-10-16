package runstore

import (
 "context"
 "errors"
 "fmt"
 "os"
 "testing"
 "time"

 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
 "go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestDeleteRejectsMissingIdentityAndStorage(t *testing.T) {
 writer := MongoDeleteWriter{}
 for _,tc := range []struct{owner,id string}{
  {"","run-1"}, {"alice",""}, {" ","run-1"}, {"alice","\t"},
 } {
  if _,err:=writer.Delete(t.Context(),tc.owner,tc.id);!errors.Is(err,ErrInvalidWrite) {
   t.Fatalf("invalid delete accepted: %#v %v",tc,err)
  }
 }
 if _,err:=writer.Delete(t.Context(),"alice","run-1");!errors.Is(err,ErrUnavailable) {
  t.Fatalf("nil writer did not fail closed: %v",err)
 }
}

func TestMongoDeleteHonorsOwnerAndDoesNotRevealForeignRuns(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("set CHRONICLES_TEST_MONGODB_URI for isolated Mongo integration")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(3*time.Second))
 if err!=nil {t.Fatal(err)}
 defer func(){_ = client.Disconnect(context.Background())}()
 db:=client.Database(fmt.Sprintf("chronicles_delete_test_%d",time.Now().UnixNano()))
 defer func(){_ = db.Drop(context.Background())}()
 collection:=db.Collection("chronicles_runs")
 create:=MongoCreateWriter{Collection:collection}
 for _,owner:=range []string{"alice","bob"} {
  run:=Run{ID:owner+"-run",OwnerID:owner,State:[]byte(`{"inventory":{"gold":10}}`)}
  if _,err:=create.Create(ctx,owner,"create-"+owner,run);err!=nil {t.Fatal(err)}
 }
 writer:=MongoDeleteWriter{Collection:collection}
 for _,id:=range []string{"bob-run","missing-run"} {
  removed,err:=writer.Delete(ctx,"alice",id)
  if err!=nil||removed {t.Fatalf("foreign and missing must be indistinguishable: %v %v",removed,err)}
 }
 removed,err:=writer.Delete(ctx,"alice","alice-run")
 if err!=nil||!removed {t.Fatalf("owner delete failed: %v %v",removed,err)}
 removed,err=writer.Delete(ctx,"alice","alice-run")
 if err!=nil||removed {t.Fatalf("second delete must be a no-op: %v %v",removed,err)}
 var kept bson.M
 if err:=collection.FindOne(ctx,bson.D{{Key:"_id",Value:"bob-run"}}).Decode(&kept);err!=nil {
  t.Fatalf("another owner's run deleted: %v",err)
 }
 count,err:=collection.CountDocuments(ctx,bson.D{})
 if err!=nil||count!=1 {t.Fatalf("unexpected survivors: %d %v",count,err)}
}
