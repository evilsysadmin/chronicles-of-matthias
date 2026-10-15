package mongoruns

import (
	"bytes"
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
	for _, tc := range []struct{uri, db string}{
		{"", "chronicles"}, {"mongodb://localhost:27017", ""},
		{"mongodb://localhost:27017", "bad.name"},
		{"mongodb://localhost:27017", "bad$db"},
	} {
		if !errors.Is(validateConfiguration(tc.uri, tc.db), ErrConfiguration) {
			t.Fatalf("configuration accepted: %q", tc.db)
		}
	}
	if validateConfiguration("mongodb://localhost:27017", "chronicles_staging") != nil {
		t.Fatal("valid database rejected")
	}
	for _, owner := range []string{"", " ", "\t"} {
		if !errors.Is(validateScope(owner, "run"), ErrInvalidScope) {
			t.Fatalf("invalid owner accepted: %q", owner)
		}
	}
}

func TestDocumentConversionCopiesState(t *testing.T) {
	d := document{RunID:"run", OwnerID:"owner", WorldVersion:3, State:[]byte(`{"gold":5}`)}
	r := d.run()
	if r.ID!="run" || r.OwnerID!="owner" || r.WorldVersion!=3 {
		t.Fatalf("unexpected envelope: %#v",r)
	}
	d.State[0]='x'
	if !bytes.Equal(r.State,[]byte(`{"gold":5}`)) {
		t.Fatal("result aliases storage buffer")
	}
}

func TestMongoOwnerIsolation(t *testing.T) {
	uri:=os.Getenv("CHRONICLES_TEST_MONGODB_URI")
	if uri=="" { t.Skip("set CHRONICLES_TEST_MONGODB_URI for Mongo integration") }
	ctx,cancel:=context.WithTimeout(context.Background(),20*time.Second)
	defer cancel()
	db:=fmt.Sprintf("chronicles_test_%d",time.Now().UnixNano())
	r,err:=Open(ctx,uri,db)
	if err!=nil { t.Fatal(err) }
	defer func(){_ = r.client.Database(db).Drop(context.Background()); _ = r.Close(context.Background())}()
	for _,d:=range []document{
		{RunID:"run-1",OwnerID:"alice",WorldVersion:1,State:[]byte("{}")},
		{RunID:"run-1",OwnerID:"bob",WorldVersion:2,State:[]byte("{}")},
	} {
		if _,err:=r.runs.InsertOne(ctx,d);err!=nil {t.Fatal(err)}
	}
	got,err:=r.Get(ctx,"alice","run-1")
	if err!=nil||got.OwnerID!="alice"||got.WorldVersion!=1 {t.Fatalf("wrong scoped run: %#v %v",got,err)}
	if _,err:=r.Get(ctx,"charlie","run-1");!errors.Is(err,runstore.ErrNotFound) {t.Fatalf("cross-owner fetch leaked: %v",err)}
	list,err:=r.List(ctx,"bob")
	if err!=nil||len(list)!=1||list[0].OwnerID!="bob" {t.Fatalf("cross-owner list leaked: %#v %v",list,err)}
	if _,err:=r.List(ctx,"");!errors.Is(err,ErrInvalidScope) {t.Fatalf("unscoped list succeeded: %v",err)}
	// MongoDB must enforce a unique owner/run pair even during concurrent writes.
	if _,err:=r.runs.InsertOne(ctx,bson.M{"ownerId":"alice","runId":"run-1"});err==nil {
		t.Fatal("unique index did not reject duplicate owner/run pair")
	}
}
