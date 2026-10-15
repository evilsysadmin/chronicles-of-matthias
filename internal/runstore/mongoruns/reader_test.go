package mongoruns

import (
 "context"
 "errors"
 "fmt"
 "os"
 "testing"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "go.mongodb.org/mongo-driver/v2/bson"
)

func TestRejectMissingOwnerAndInvalidConfig(t *testing.T) {
 for _,tc:=range []struct{uri,db string}{
  {"","chronicles"},{"mongodb://localhost:27017",""},
  {"mongodb://localhost:27017","bad.name"},
  {"mongodb://localhost:27017","bad$db"},
 } {
  if !errors.Is(validateConfiguration(tc.uri,tc.db),ErrConfiguration) {t.Fatalf("configuration accepted: %q",tc.db)}
 }
 if validateConfiguration("mongodb://localhost:27017","chronicles_staging")!=nil {t.Fatal("valid database rejected")}
 for _,owner:=range []string{""," ","\t"} {
  if !errors.Is(validateScope(owner,"run"),ErrInvalidScope) {t.Fatalf("invalid owner accepted: %q",owner)}
 }
}

func TestDocumentConversionKeepsLegacyIdentityButNotFakeCheckpoint(t *testing.T) {
 d:=document{RunID:"legacy-run",OwnerID:"owner",WorldVersion:3,Status:"active"}
 r:=d.run()
 if r.ID!="legacy-run"||r.OwnerID!="owner"||r.WorldVersion!=3 {
  t.Fatalf("unexpected envelope: %#v",r)
 }
 if r.State!=nil {t.Fatal("adapter must not invent a checkpoint state from legacy data")}
}

func TestMongoLegacyOwnerIsolationAndActiveList(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("set CHRONICLES_TEST_MONGODB_URI for Mongo integration")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 db:=fmt.Sprintf("chronicles_legacy_test_%d",time.Now().UnixNano())
 r,err:=Open(ctx,uri,db)
 if err!=nil {t.Fatal(err)}
 defer func(){_ = r.client.Database(db).Drop(context.Background());_ = r.Close(context.Background())}()
 now:=time.Now().UTC()
 fixture:=[]document{
  {RunID:"alice-run",OwnerID:"alice",WorldVersion:1,Status:"active",UpdatedAt:bson.NewDateTimeFromTime(now)},
  {RunID:"bob-run",OwnerID:"bob",WorldVersion:2,Status:"active",UpdatedAt:bson.NewDateTimeFromTime(now)},
  {RunID:"alice-finished",OwnerID:"alice",WorldVersion:9,Status:"completed",UpdatedAt:bson.NewDateTimeFromTime(now)},
 }
 for _,d:=range fixture {if _,err:=r.runs.InsertOne(ctx,d);err!=nil{t.Fatal(err)}}
 got,err:=r.Get(ctx,"alice","alice-run")
 if err!=nil||got.OwnerID!="alice"||got.ID!="alice-run"||got.WorldVersion!=1 {t.Fatalf("wrong scoped run: %#v %v",got,err)}
 if _,err:=r.Get(ctx,"bob","alice-run");!errors.Is(err,runstore.ErrNotFound) {t.Fatalf("cross-owner fetch leaked: %v",err)}
 list,err:=r.List(ctx,"bob")
 if err!=nil||len(list)!=1||list[0].ID!="bob-run" {t.Fatalf("cross-owner list leaked: %#v %v",list,err)}
 alice,err:=r.List(ctx,"alice")
 if err!=nil||len(alice)!=1||alice[0].ID!="alice-run" {t.Fatalf("terminal run incorrectly listed: %#v %v",alice,err)}
 if _,err:=r.List(ctx,"");!errors.Is(err,ErrInvalidScope) {t.Fatalf("unscoped list succeeded: %v",err)}
 // The source Python/Go schema has one globally unique _id, not one ID
 // per owner. The MongoDB default _id index must prevent duplicate runs.
 if _,err:=r.runs.InsertOne(ctx,bson.M{"_id":"alice-run","owner":"bob"});err==nil {
  t.Fatal("Mongo _id uniqueness did not reject duplicate run")
 }
 // Existing saves without a status field count as active.
 if _,err:=r.runs.InsertOne(ctx,bson.M{"_id":"legacy-statusless","owner":"alice","worldVersion":int64(4)});err!=nil{t.Fatal(err)}
 alice,err=r.List(ctx,"alice")
 if err!=nil||len(alice)!=2 {t.Fatalf("legacy statusless run omitted: %#v %v",alice,err)}
}

func TestMongoLegacyListIsBoundedAndRecentFirst(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("set CHRONICLES_TEST_MONGODB_URI for Mongo integration")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 db:=fmt.Sprintf("chronicles_list_test_%d",time.Now().UnixNano())
 r,err:=Open(ctx,uri,db)
 if err!=nil{t.Fatal(err)}
 defer func(){_ = r.client.Database(db).Drop(context.Background());_ = r.Close(context.Background())}()
 for i:=0;i<35;i++ {
  d:=document{RunID:fmt.Sprintf("run-%02d",i),OwnerID:"alice",WorldVersion:int64(i),Status:"active",
   UpdatedAt:bson.NewDateTimeFromTime(time.Unix(int64(i+1),0))}
  if _,err:=r.runs.InsertOne(ctx,d);err!=nil{t.Fatal(err)}
 }
 list,err:=r.List(ctx,"alice")
 if err!=nil||len(list)!=30{t.Fatalf("expected bounded 30 saves, got %d %v",len(list),err)}
 if list[0].ID!="run-34"||list[29].ID!="run-05" {t.Fatalf("unexpected recency order: %s ... %s",list[0].ID,list[29].ID)}
}
