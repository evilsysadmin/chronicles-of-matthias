package mongoruns

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "testing"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "go.mongodb.org/mongo-driver/v2/bson"
)

// Source contract: Chess Studio backend-go/internal/chroniclesrun/store.go,
// Summary(), and backend-go/internal/chroniclesrun/mongo.go, ListActive().
// This exercises the shape independently, without importing Chess Studio.
func TestCanonicalListSummarySerialization(t *testing.T) {
 d := document{
  RunID: "legacy-run", OwnerID: "alice",
  CurrentMapID: "crypt-eight-squares", WorldVersion: 7,
  UpdatedAt: bson.DateTime(1791192000125),
 }
 got, err := json.Marshal(d.summary())
 if err != nil {t.Fatal(err)}
 want := `{"runId":"legacy-run","currentMapId":"crypt-eight-squares","status":"active","worldVersion":7,"updatedAtMs":1791192000125}`
 if string(got) != want { t.Fatalf("list JSON contract changed:\ngot:  %s\nwant: %s",got,want) }
 d.Status = "defeated"
 if d.summary().Status != "defeated" {t.Fatal("explicit terminal status ignored")}
 if d.summary().RunID != d.RunID {t.Fatal("incorrect legacy _id mapping")}
}

// Runs remain private until the real auth adapter exists; no HTTP routes
// are added in this PR. Test the Mongo query with the canonical legacy fields.
func TestMongoSummaryParityAndOwnerIsolation(t *testing.T) {
 uri := os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri == "" {t.Skip("MongoDB integration service not configured")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 db:=fmt.Sprintf("chronicles_summary_%d",time.Now().UnixNano())
 reader,err:=Open(ctx,uri,db)
 if err != nil {t.Fatal(err)}
 defer func(){
  _ = reader.client.Database(db).Drop(context.Background())
  _ = reader.Close(context.Background())
 }()
 inserted:=[]bson.M{
  {"_id":"a1","owner":"alice","currentMapId":"crypt-eight-squares","status":"active","worldVersion":int64(3),"updatedAt":bson.DateTime(1780000000100)},
  {"_id":"a2","owner":"alice","currentMapId":"ash-vault","worldVersion":int64(4),"updatedAt":bson.DateTime(1780000000200)},
  {"_id":"a3","owner":"alice","currentMapId":"crypt-eight-squares","status":"completed","worldVersion":int64(5),"updatedAt":bson.DateTime(1780000000300)},
  {"_id":"b1","owner":"bob","currentMapId":"gallery-of-forks","status":"active","worldVersion":int64(9),"updatedAt":bson.DateTime(1780000000400)},
 }
 for _,v:=range inserted {if _,err:=reader.runs.InsertOne(ctx,v);err!=nil{t.Fatal(err)}}
 summaries,err:=reader.ListSummaries(ctx,"alice")
 if err!=nil {t.Fatal(err)}
 if len(summaries)!=2 {t.Fatalf("expected two active/legacy saves, got %#v",summaries)}
 want:=[]runstore.Summary{
  {RunID:"a2",CurrentMapID:"ash-vault",Status:"active",WorldVersion:4,UpdatedAtMs:1780000000200},
  {RunID:"a1",CurrentMapID:"crypt-eight-squares",Status:"active",WorldVersion:3,UpdatedAtMs:1780000000100},
 }
 for i:=range want {if summaries[i]!=want[i] {t.Fatalf("summary %d: got %#v want %#v",i,summaries[i],want[i])}}
 if _,err:=reader.ListSummaries(ctx," ");!errors.Is(err,ErrInvalidScope) {t.Fatalf("unscoped list unexpectedly accepted: %v",err)}
 bob,err:=reader.ListSummaries(ctx,"bob")
 if err!=nil || len(bob)!=1 || bob[0].RunID!="b1" {t.Fatalf("cross-owner result: %#v %v",bob,err)}
}
