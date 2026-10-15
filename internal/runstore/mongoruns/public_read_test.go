package mongoruns

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "strings"
 "testing"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/legacyread"
 "go.mongodb.org/mongo-driver/v2/bson"
)

func TestMongoPublicRunReadRequiresMatchingOwner(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("MongoDB integration is not configured")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 db:=fmt.Sprintf("chronicles_public_read_%d",time.Now().UnixNano())
 r,err:=Open(ctx,uri,db)
 if err!=nil {t.Fatal(err)}
 defer func(){_ = r.client.Database(db).Drop(context.Background());_ = r.Close(context.Background())}()
 date:=bson.NewDateTimeFromTime(time.Date(2026,10,5,12,0,0,125000000,time.UTC))
 row:=bson.D{
  {Key:"_id",Value:"legacy-run-1"},
  {Key:"owner",Value:"alice"},
  {Key:"createFingerprint",Value:"SECRET-FINGERPRINT"},
  {Key:"seed",Value:int64(417)},
  {Key:"currentMapId",Value:"crypt-eight-squares"},
  {Key:"contentVersion",Value:int64(11)},
  {Key:"manifestRevision",Value:"revision-a"},
  {Key:"worldVersion",Value:int64(2)},
  {Key:"worldFlags",Value:bson.D{{Key:"door",Value:true}}},
  {Key:"inventory",Value:bson.D{{Key:"key",Value:bson.D{{Key:"quantity",Value:int32(1)}}}}},
  {Key:"quests",Value:bson.D{}},
  {Key:"claimedRewards",Value:bson.A{"reward-a"}},
  {Key:"createdAt",Value:date},
  {Key:"updatedAt",Value:date},
 }
 if _,err:=r.runs.InsertOne(ctx,row);err!=nil{t.Fatal(err)}
 actual,err:=r.GetPublic(ctx,"alice","legacy-run-1")
 if err!=nil{t.Fatal(err)}
 if actual.RunID!="legacy-run-1"||actual.CurrentMapID!="crypt-eight-squares"||
  actual.WorldVersion!=2||actual.WorldFlags["door"]!=true||
  actual.Inventory["key"].(map[string]any)["quantity"]!=int32(1) {
  t.Fatalf("legacy checkpoint fields were changed: %#v",actual)
 }
 jsonBytes,err:=json.Marshal(actual)
 if err!=nil{t.Fatal(err)}
 if strings.Contains(string(jsonBytes),"alice")||strings.Contains(string(jsonBytes),"SECRET-FINGERPRINT"){
  t.Fatalf("private fields leaked into public response: %s",jsonBytes)
 }
 if actual.UpdatedAt==nil||*actual.UpdatedAt!="2026-10-05T12:00:00.125000" {
  t.Fatalf("timestamp compatibility changed: %#v",actual.UpdatedAt)
 }
 for _,owner:=range []string{"bob","charlie"} {
  if _,err:=r.GetPublic(ctx,owner,"legacy-run-1");!errors.Is(err,runstore.ErrNotFound){
   t.Fatalf("cross-owner lookup for %s leaked: %v",owner,err)
  }
 }
 if _,err:=r.GetPublic(ctx,"alice","missing");!errors.Is(err,runstore.ErrNotFound){
  t.Fatalf("missing run response changed: %v",err)
 }
 for _,invalid:=range [][2]string{{"","legacy-run-1"},{" ","legacy-run-1"},{"alice",""}} {
  if _,err:=r.GetPublic(ctx,invalid[0],invalid[1]);!errors.Is(err,ErrInvalidScope){
   t.Fatalf("invalid scope unexpectedly accepted: %#v %v",invalid,err)
  }
 }
}

func TestMongoPublicRunRejectsCorruptLegacyCheckpoint(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("MongoDB integration is not configured")}
 ctx,cancel:=context.WithTimeout(context.Background(),20*time.Second)
 defer cancel()
 db:=fmt.Sprintf("chronicles_corrupt_read_%d",time.Now().UnixNano())
 r,err:=Open(ctx,uri,db)
 if err!=nil{t.Fatal(err)}
 defer func(){_ = r.client.Database(db).Drop(context.Background());_ = r.Close(context.Background())}()
 if _,err:=r.runs.InsertOne(ctx,bson.M{
  "_id":"corrupt","owner":"alice","currentMapId":"crypt","contentVersion":int64(11),
  "manifestRevision":"rev",
 });err!=nil{t.Fatal(err)}
 if _,err:=r.GetPublic(ctx,"alice","corrupt");!errors.Is(err,legacyread.ErrCorruptRun){
  t.Fatalf("corrupt document silently accepted: %v",err)
 }
}
