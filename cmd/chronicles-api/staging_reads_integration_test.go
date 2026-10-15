package main

import (
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "fmt"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "testing"
 "time"

 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
 "go.mongodb.org/mongo-driver/v2/mongo/options"
)

func stagingTestJWT(subject string,version int64,secret []byte)string {
 head:=base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
 payload:=fmt.Sprintf(`{"sub":%q,"purpose":"session","sv":%d,"exp":%d}`,
  subject,version,time.Now().Add(time.Hour).Unix())
 body:=base64.RawURLEncoding.EncodeToString([]byte(payload))
 unsigned:=head+"."+body
 mac:=hmac.New(sha256.New,secret)
 _,_=mac.Write([]byte(unsigned))
 return unsigned+"."+base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func stagedHTTP(h http.Handler,method,path,token,spoof string)*httptest.ResponseRecorder{
 recorder:=httptest.NewRecorder()
 request:=httptest.NewRequest(method,path,nil)
 if token!=""{request.Header.Set("Authorization","Bearer "+token)}
 if spoof!=""{request.Header.Set("X-Owner-Id",spoof)}
 h.ServeHTTP(recorder,request)
 return recorder
}

// The test uses a throwaway Mongo database and synthetic accounts. No real
// Chess Studio users or production keys are needed to exercise the full chain.
func TestStagingReadAPIEndToEndWithRealMongo(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("requires CI Mongo integration")}
 ctx,cancel:=context.WithTimeout(context.Background(),30*time.Second)
 defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(3*time.Second))
 if err!=nil{t.Fatal(err)}
 defer func(){_=client.Disconnect(context.Background())}()
 dbName:=fmt.Sprintf("chronicles_staged_reads_%d",time.Now().UnixNano())
 db:=client.Database(dbName)
 defer func(){_=db.Drop(context.Background())}()
 secret:=[]byte(strings.Repeat("q",40))
 app,closeStorage,err:=configuredHandlerWithReads(ctx,uri,dbName,readOptions{
  Enabled:true,Environment:"staging",SessionSecret:secret,
 })
 if err!=nil{t.Fatal(err)}
 defer func(){_=closeStorage(context.Background())}()
 for _,user:=range []bson.M{
  {"_id":"alice","session_version":int64(3)},
  {"_id":"bob","session_version":int64(2)},
 }{
  if _,err:=db.Collection("users").InsertOne(ctx,user);err!=nil{t.Fatal(err)}
 }
 dated:=bson.NewDateTimeFromTime(time.Now().UTC())
 if _,err:=db.Collection("chronicles_runs").InsertOne(ctx,bson.M{
  "_id":"expedition-1","owner":"alice","seed":int64(19),
  "currentMapId":"crypt-eight-squares","contentVersion":int64(11),
  "manifestRevision":"revision-1","worldVersion":int64(4),"status":"active",
  "worldFlags":bson.M{"door":true},"inventory":bson.M{"key":bson.M{"quantity":int64(1)}},
  "quests":bson.M{"quest-1":bson.M{"status":"active"}},"createdAt":dated,"updatedAt":dated,
  "createFingerprint":"never-expose-this",
 });err!=nil{t.Fatal(err)}
 alice:=stagingTestJWT("alice",3,secret)
 bob:=stagingTestJWT("bob",2,secret)
 for _,tc:=range []struct{name,method,path,token,spoof string;want int}{
  {"readiness","GET","/readyz","","",200},
  {"missing auth","GET","/api/chronicles/runs","","alice",401},
  {"unknown bearer","GET","/api/chronicles/runs","incorrect","alice",401},
  {"alice list","GET","/api/chronicles/runs",alice,"bob",200},
  {"bob list","GET","/api/chronicles/runs",bob,"alice",200},
  {"alice get","GET","/api/chronicles/runs/expedition-1",alice,"bob",200},
  {"bob get denied","GET","/api/chronicles/runs/expedition-1",bob,"alice",404},
  {"writes disabled","POST","/api/chronicles/runs",alice,"",405},
  {"checkpoint disabled","PUT","/api/chronicles/runs/expedition-1/checkpoint",alice,"",404},
  {"bootstrap disabled","GET","/api/chronicles/runs/expedition-1/bootstrap",alice,"",404},
  {"delete disabled","DELETE","/api/chronicles/runs/expedition-1",alice,"",405},
 }{
  t.Run(tc.name,func(t *testing.T){
   got:=stagedHTTP(app,tc.method,tc.path,tc.token,tc.spoof)
   if got.Code!=tc.want {t.Fatalf("%s %s got %d: %s",tc.method,tc.path,got.Code,got.Body.String())}
   if tc.name=="alice list"{
    var list struct{Runs []struct{RunID string `json:"runId"`} `json:"runs"`}
    if err:=json.Unmarshal(got.Body.Bytes(),&list);err!=nil{t.Fatal(err)}
    if len(list.Runs)!=1||list.Runs[0].RunID!="expedition-1"{t.Fatalf("unexpected list: %s",got.Body.String())}
   }
   if tc.name=="bob list" && strings.TrimSpace(got.Body.String())!=`{"runs":[]}`{
    t.Fatalf("other owner list leaked: %s",got.Body.String())
   }
   if tc.name=="alice get"{
    if !strings.Contains(got.Body.String(),`"worldFlags":{"door":true}`) ||
     !strings.Contains(got.Body.String(),`"inventory":{"key":{"quantity":1}}`) ||
     strings.Contains(got.Body.String(),"never-expose-this") ||
     strings.Contains(got.Body.String(),`"owner"`){
      t.Fatalf("unsafe or incomplete save read: %s",got.Body.String())
    }
   }
  })
 }
 // Revoke the active token without changing JWT bytes.
 if _,err:=db.Collection("users").UpdateOne(ctx,bson.M{"_id":"alice"},
  bson.M{"$set":bson.M{"session_version":int64(4)}});err!=nil{t.Fatal(err)}
 if got:=stagedHTTP(app,"GET","/api/chronicles/runs",alice,"");got.Code!=401{
  t.Fatalf("revoked user accepted: %d %s",got.Code,got.Body.String())
 }
}
