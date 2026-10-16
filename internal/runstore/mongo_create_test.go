package runstore

import (
 "bytes"
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

func TestCreateFingerprintIsCanonicalAndRequestScoped(t *testing.T) {
 first,err:=createFingerprint("run-1","request-1",[]byte(`{"b":9007199254740993,"a":true}`))
 if err!=nil {t.Fatal(err)}
 same,err:=createFingerprint("run-1","request-1",[]byte(`{ "a": true, "b": 9007199254740993 }`))
 if err!=nil||first!=same {t.Fatalf("semantic retry hash changed: %v",err)}
 for _,tc:=range []struct{id,key,body string}{
  {"run-2","request-1",`{"a":true,"b":9007199254740993}`},
  {"run-1","request-2",`{"a":true,"b":9007199254740993}`},
  {"run-1","request-1",`{"a":true,"b":9007199254740994}`},
 } {
  other,err:=createFingerprint(tc.id,tc.key,[]byte(tc.body))
  if err!=nil||first==other {t.Fatalf("different create requests collided: %v",err)}
 }
}

func TestNilMongoCreateWriterFailsClosed(t *testing.T) {
 valid:=Run{ID:"run-1",OwnerID:"alice",State:[]byte(`{"worldFlags":{}}`)}
 _,err:=(MongoCreateWriter{}).Create(t.Context(),"alice","key-1",valid)
 if !errors.Is(err,ErrUnavailable) {t.Fatalf("expected unavailable, got %v",err)}
 _,err=(MongoCreateWriter{}).Create(t.Context(),"bob","key-1",valid)
 if !errors.Is(err,ErrInvalidWrite) {t.Fatalf("foreign owner accepted: %v",err)}
}

func TestMongoCreateIsOwnerScopedAndIdempotent(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("set CHRONICLES_TEST_MONGODB_URI for isolated Mongo integration")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(3*time.Second))
 if err!=nil {t.Fatal(err)}
 defer func(){_ = client.Disconnect(context.Background())}()
 db:=client.Database(fmt.Sprintf("chronicles_create_test_%d",time.Now().UnixNano()))
 defer func(){_ = db.Drop(context.Background())}()
 collection:=db.Collection("chronicles_runs")
 writer:=MongoCreateWriter{Collection:collection}
 initial:=Run{ID:"run-1",OwnerID:"alice",State:[]byte(`{"inventory":{"gold":12},"quests":{}}`)}
 first,err:=writer.Create(ctx,"alice","key-1",initial)
 if err!=nil||first.WorldVersion!=0||!bytes.Equal(first.State,initial.State) {t.Fatalf("initial create failed: %#v %v",first,err)}
 retry:=initial
 retry.State=[]byte(`{"quests":{}, "inventory":{"gold":12}}`)
 replayed,err:=writer.Create(ctx,"alice","key-1",retry)
 if err!=nil||!bytes.Equal(replayed.State,initial.State) {t.Fatalf("replay changed stored data: %#v %v",replayed,err)}
 for _,tc:=range []struct{owner,key string;run Run}{
  {"alice","different-key",initial},
  {"alice","key-1",Run{ID:"run-1",OwnerID:"alice",State:[]byte(`{"inventory":{"gold":999}}`)}},
  {"bob","key-1",Run{ID:"run-1",OwnerID:"bob",State:initial.State}},
 } {
  _,err:=writer.Create(ctx,tc.owner,tc.key,tc.run)
  if !errors.Is(err,ErrConflict) {t.Fatalf("collision returned %v, expected conflict",err)}
 }
 count,err:=collection.CountDocuments(ctx,bson.D{})
 if err!=nil||count!=1 {t.Fatalf("duplicate create inserted %d records: %v",count,err)}
 advanced,err:=(MongoCheckpointWriter{Collection:collection}).Checkpoint(ctx,"alice","run-1",0,"checkpoint-1",[]byte(`{"inventory":{"gold":13}}`))
 if err!=nil||advanced.WorldVersion!=1 {t.Fatalf("checkpoint CAS incompatible with create: %#v %v",advanced,err)}
 latest,err:=writer.Create(ctx,"alice","key-1",initial)
 if err!=nil||latest.WorldVersion!=1||string(latest.State)!=`{"inventory":{"gold":13}}` {t.Fatalf("replay overwrote advanced run: %#v %v",latest,err)}
}
