package runstore

import (
 "errors"
 "strings"
 "testing"
)

func TestValidateCreateBoundary(t *testing.T) {
 good:=Run{ID:"run-1",OwnerID:"alice",WorldVersion:0,State:[]byte(`{"inventory":{"gold":10},"quests":{}}`)}
 if err:=ValidateCreateBoundary("alice","request-1",good);err!=nil {t.Fatal(err)}
 cases:=[]struct{name string;owner,key string;run Run}{
  {"missing owner","","key",good},
  {"missing key","alice","",good},
  {"foreign owner","bob","key",good},
  {"empty id","alice","key",Run{OwnerID:"alice",State:good.State}},
  {"wrong version","alice","key",Run{ID:"run-1",OwnerID:"alice",WorldVersion:1,State:good.State}},
  {"non object","alice","key",Run{ID:"run-1",OwnerID:"alice",State:[]byte(`[]`)}},
  {"invalid json","alice","key",Run{ID:"run-1",OwnerID:"alice",State:[]byte(`{"a":`)}},
 }
 for _,tc:=range cases {t.Run(tc.name,func(t *testing.T){if !errors.Is(ValidateCreateBoundary(tc.owner,tc.key,tc.run),ErrInvalidWrite){t.Fatal("expected invalid write")}})}
}

func TestValidateCheckpointBoundary(t *testing.T) {
 valid:=[]byte(`{"worldFlags":{"gate":true}}`)
 if err:=ValidateCheckpointBoundary("alice","run-1",0,"request-1",valid);err!=nil {t.Fatal(err)}
 cases:=[]struct{owner,id string;version int64;key string;state []byte}{
  {"","run-1",0,"key",valid},{"alice","",0,"key",valid},
  {"alice","run-1",-1,"key",valid},{"alice","run-1",0,"",valid},
  {"alice","run-1",0,"key",nil},{"alice","run-1",0,"key",[]byte("null")},
  {"alice","run-1",0,"key",[]byte(strings.Repeat("x",2<<20+1))},
 }
 for i,tc:=range cases {if !errors.Is(ValidateCheckpointBoundary(tc.owner,tc.id,tc.version,tc.key,tc.state),ErrInvalidWrite){t.Fatalf("case %d accepted",i)}}
}
