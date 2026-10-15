package legacyread

import (
 "encoding/json"
 "errors"
 "reflect"
 "strings"
 "testing"
 "time"

 "go.mongodb.org/mongo-driver/v2/bson"
)

// Python source: backend-python/chronicles_run_store.py::_public.
// Parity fixture: backend-go/internal/gamesapi/testdata/
// python_chronicles_runs_corpus.json, step "get", source Chess Studio.
// These tests compare semantic JSON content; route-level *byte* parity is a
// later gate because Python and Go differ in JSON ordering and HTML escaping.
func TestPublicMatchesPythonGetFixture(t *testing.T){
 row:=bson.D{
  {Key:"_id",Value:"92b51d4c-6f01-5dc4-8199-2ffde9aa7427"},
  {Key:"owner",Value:"alice"},
  {Key:"createFingerprint",Value:"PRIVATE"},
  {Key:"seed",Value:int64(417)},
  {Key:"contentPlacementVersion",Value:int64(2)},
  {Key:"currentMapId",Value:"crypt-eight-squares"},
  {Key:"contentVersion",Value:int64(11)},
  {Key:"manifestRevision",Value:"4890d97ab193a91675c03828fadeb58c86b1e6eaaf852e4feaf71833126cf4db"},
  {Key:"status",Value:"active"},
  {Key:"worldVersion",Value:int64(0)},
  {Key:"consumedContentIds",Value:bson.A{}},
  {Key:"claimedRewards",Value:bson.A{}},
  {Key:"worldFlags",Value:bson.D{}},
  {Key:"inventory",Value:bson.D{}},
  {Key:"quests",Value:bson.D{}},
  {Key:"createdAt",Value:bson.NewDateTimeFromTime(time.Date(2026,10,5,12,0,0,125000000,time.UTC))},
  {Key:"updatedAt",Value:bson.NewDateTimeFromTime(time.Date(2026,10,5,12,0,0,125000000,time.UTC))},
 }
 actual,err:=Public(row)
 if err!=nil{t.Fatal(err)}
 data,err:=json.Marshal(actual)
 if err!=nil{t.Fatal(err)}
 expected:=`{"runId":"92b51d4c-6f01-5dc4-8199-2ffde9aa7427","seed":417,"contentPlacementVersion":2,"currentMapId":"crypt-eight-squares","contentVersion":11,"manifestRevision":"4890d97ab193a91675c03828fadeb58c86b1e6eaaf852e4feaf71833126cf4db","status":"active","worldVersion":0,"consumedContentIds":[],"claimedRewards":[],"worldFlags":{},"inventory":{},"quests":{},"createdAt":"2026-10-05T12:00:00.125000","updatedAt":"2026-10-05T12:00:00.125000"}`
 var wantJSON,gotJSON any
 if err:=json.Unmarshal([]byte(expected),&wantJSON);err!=nil{t.Fatal(err)}
 if err:=json.Unmarshal(data,&gotJSON);err!=nil{t.Fatal(err)}
 if !reflect.DeepEqual(gotJSON,wantJSON){t.Fatalf("Python response mismatch:\nGo: %s\nPython: %s",data,expected)}
 if strings.Contains(string(data),"alice")||strings.Contains(string(data),"PRIVATE"){t.Fatal("storage-only fields leaked")}
}

func TestPublicCopiesNestedCheckpointAndRoute(t *testing.T){
 flags:=bson.D{{Key:"door",Value:true},{Key:"count",Value:int64(3)}}
 entries:=bson.D{{Key:"sword",Value:bson.D{{Key:"quantity",Value:int64(2)},{Key:"name",Value:"Espada"}}}}
 doc:=bson.D{
  {Key:"_id",Value:"route-1"}, {Key:"seed",Value:int64(7)},
  {Key:"currentMapId",Value:"cave"},{Key:"contentVersion",Value:int32(11)},
  {Key:"manifestRevision",Value:"revision-1"},
  {Key:"worldFlags",Value:flags},{Key:"inventory",Value:entries},
  {Key:"routePolicyVersion",Value:int32(2)},
  {Key:"routeMapIds",Value:bson.A{"cave","castle"}},
  {Key:"routePrimaryExitIds",Value:bson.D{{Key:"cave",Value:"east"}}},
  {Key:"plannerSnapshot",Value:bson.D{{Key:"path",Value:bson.A{"cave","castle"}}}},
 }
 result,err:=Public(doc)
 if err!=nil{t.Fatal(err)}
 if result.Status!="active"||result.WorldVersion!=0 || result.Route==nil || len(result.Route.MapIDs)!=2 {t.Fatalf("missing defaults/route: %#v",result)}
 if result.CreatedAt!=nil||result.UpdatedAt!=nil {t.Fatal("missing timestamps must remain null")}
 flags[0].Value=false
 entries[0].Value=bson.D{{Key:"quantity",Value:int64(999)}}
 if result.WorldFlags["door"]!=true{t.Fatal("world flags alias original Mongo row")}
 if result.Inventory["sword"].(map[string]any)["quantity"]!=int64(2){t.Fatal("inventory aliases Mongo row")}
 rendered,err:=json.Marshal(result)
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(rendered),`"mapIds":["cave","castle"]`) ||
  !strings.Contains(string(rendered),`"plannerSnapshot":{"path":["cave","castle"]}`) {
  t.Fatalf("invalid nested JSON: %s",rendered)
 }
 if strings.Contains(string(rendered),`"owner"`){t.Fatal("storage owner leaked")}
}

func TestPublicRejectsCorruptSaveInsteadOfInventingFields(t *testing.T){
 valid:=bson.D{
  {Key:"_id",Value:"run"},{Key:"seed",Value:int64(1)},
  {Key:"currentMapId",Value:"crypt"},{Key:"contentVersion",Value:int64(11)},
  {Key:"manifestRevision",Value:"rev"},
 }
 for _,key:=range []string{"seed","currentMapId","contentVersion","manifestRevision"} {
  altered:=bson.D{}
  for _,e:=range valid {if e.Key!=key{altered=append(altered,e)}}
  if _,err:=Public(altered);!errors.Is(err,ErrCorruptRun) {
   t.Fatalf("missing %s unexpectedly accepted: %v",key,err)
  }
 }
 corrupt:=append(append(bson.D{},valid...),bson.E{Key:"claimedRewards",Value:bson.A{"ok",int32(4)}})
 if _,err:=Public(corrupt);!errors.Is(err,ErrCorruptRun){t.Fatalf("invalid rewards accepted: %v",err)}
}
