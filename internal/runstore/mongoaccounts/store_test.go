package mongoaccounts

import (
 "context"
 "errors"
 "fmt"
 "os"
 "strings"
 "testing"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/sessionverify"
 "go.mongodb.org/mongo-driver/v2/bson"
 "go.mongodb.org/mongo-driver/v2/mongo"
 "go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestMongoAccountRequiresExplicitDatabase(t *testing.T){
 if _,err:=New(nil);!errors.Is(err,ErrUnconfigured){t.Fatalf("nil DB accepted: %v",err)}
 var store *Store
 if _,_,err:=store.CurrentSession(context.Background(),"alice");!errors.Is(err,ErrUnconfigured){
  t.Fatalf("nil store accepted: %v",err)
 }
}

func TestLegacySessionVersionsAndRevocationWithRealMongo(t *testing.T) {
 uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
 if uri=="" {t.Skip("Mongo integration not configured")}
 ctx,cancel:=context.WithTimeout(context.Background(),25*time.Second)
 defer cancel()
 client,err:=mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(3*time.Second))
 if err!=nil{t.Fatal(err)}
 defer func(){_ = client.Disconnect(context.Background())}()
 dbName:=fmt.Sprintf("chronicles_auth_test_%d",time.Now().UnixNano())
 db:=client.Database(dbName)
 defer func(){_ = db.Drop(context.Background())}()
 store,err:=New(db)
 if err!=nil{t.Fatal(err)}
 for _,record:=range []bson.M{
  {"_id":"alice","session_version":int64(3)},
  {"_id":"legacy"},
  {"_id":"nullver","session_version":nil},
  {"_id":"invalid","session_version":"3"},
  {"_id":"negative","session_version":int64(-1)},
 } {
  if _,err:=db.Collection("users").InsertOne(ctx,record);err!=nil{t.Fatal(err)}
 }
 for _,tc:=range []struct{user string;version int64;found bool;wantErr bool}{
  {"alice",3,true,false},
  {"legacy",0,true,false},
  {"nullver",0,true,false},
  {"missing",0,false,false},
  {"invalid",0,false,true},
  {"negative",0,false,true},
 } {
  v,found,err:=store.CurrentSession(ctx,tc.user)
  if v!=tc.version||found!=tc.found||(err!=nil)!=tc.wantErr{
   t.Errorf("%s: got version=%d found=%v err=%v",tc.user,v,found,err)
  }
 }
 if _,_,err:=store.CurrentSession(ctx," ");!errors.Is(err,ErrInvalidAccount){
  t.Fatalf("blank username accepted: %v",err)
 }
 now:=time.Date(2026,10,5,12,0,0,0,time.UTC)
 verifier,err:=sessionverify.New([]byte(strings.Repeat("s",32)),store,func()time.Time{return now})
 if err!=nil{t.Fatal(err)}
 // Exact PyJWT 2.15 token from the Chess Studio parity corpus.
 const token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSIsInB1cnBvc2UiOiJzZXNzaW9uIiwic3YiOjMsImV4cCI6MTc5Mzc5MzYwMH0.j_hwcd9CVLR9mTzl3Azlwm9xs3fxQbzBEj11hyK1fak"
 subject,err:=verifier.VerifyOwner(ctx,token)
 if err!=nil||subject!="alice"{t.Fatalf("legitimate Python session rejected: %s %v",subject,err)}
 if _,err:=db.Collection("users").UpdateOne(ctx,bson.M{"_id":"alice"},bson.M{"$set":bson.M{"session_version":int64(4)}});err!=nil{t.Fatal(err)}
 if _,err:=verifier.VerifyOwner(ctx,token);!errors.Is(err,sessionverify.ErrUnauthorized){
  t.Fatalf("revoked existing JWT accepted: %v",err)
 }
 if _,err:=db.Collection("users").DeleteOne(ctx,bson.M{"_id":"alice"});err!=nil{t.Fatal(err)}
 if _,err:=verifier.VerifyOwner(ctx,token);!errors.Is(err,sessionverify.ErrUnauthorized){
  t.Fatalf("deleted user accepted: %v",err)
 }
}
