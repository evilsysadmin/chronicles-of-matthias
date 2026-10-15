package main

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestStagingReadGateRequiresExplicitOptIn(t *testing.T) {
 for _,tc:=range []struct{name,flag,environment string;valid bool}{
  {"default","","staging",true},
  {"off","false","production",true},
  {"invalid flag","1","staging",false},
  {"production","true","production",false},
  {"no environment","true","",false},
  {"dev","true","development",false},
 } {
  t.Run(tc.name,func(t *testing.T){
   t.Setenv("CHRONICLES_ENABLE_READ_API",tc.flag)
   t.Setenv("CHRONICLES_ENVIRONMENT",tc.environment)
   t.Setenv("CHRONICLES_JWT_SECRET_FILE","")
   _,err:=stagingReadOptionsFromEnv()
   if tc.flag=="true" || !tc.valid {
    if !errors.Is(err,errReadConfig){t.Fatalf("invalid opt-in accepted: %v",err)}
   } else if err!=nil{t.Fatalf("disabled setting rejected: %v",err)}
  })
 }
 for _,tc:=range []struct{name string;options readOptions}{
  {"production",readOptions{Enabled:true,Environment:"production",SessionSecret:[]byte(strings.Repeat("s",32))}},
  {"no secret",readOptions{Enabled:true,Environment:"staging"}},
  {"no database",readOptions{Enabled:true,Environment:"staging",SessionSecret:[]byte(strings.Repeat("s",32))}},
 }{
  t.Run(tc.name,func(t *testing.T){
   _,_,err:=configuredHandlerWithReads(context.Background(),"","",tc.options)
   if !errors.Is(err,errReadGate) {t.Fatalf("staging-only gate bypassed: %v",err)}
  })
 }
}

func TestSigningKeyFileIsRequired(t *testing.T) {
 t.Setenv("CHRONICLES_ENABLE_READ_API","true")
 t.Setenv("CHRONICLES_ENVIRONMENT","staging")
 folder:=t.TempDir()
 valid:=filepath.Join(folder,"jwt-key")
 key:=strings.Repeat("k",40)+"\n"
 if err:=os.WriteFile(valid,[]byte(key),0600);err!=nil{t.Fatal(err)}
 t.Setenv("CHRONICLES_JWT_SECRET_FILE",valid)
 opts,err:=stagingReadOptionsFromEnv()
 if err!=nil || !opts.Enabled || string(opts.SessionSecret)!=strings.Repeat("k",40) {
  t.Fatalf("valid file secret rejected: %#v %v",opts,err)
 }
 cases:=[]struct{name,path string}{
  {"relative","secret"},
  {"missing",filepath.Join(folder,"missing")},
 }
 link:=filepath.Join(folder,"alias")
 if err:=os.Symlink(valid,link);err!=nil{t.Fatal(err)}
 cases=append(cases,struct{name,path string}{"symlink",link})
 for _,tc:=range cases {
  t.Run(tc.name,func(t *testing.T){
   t.Setenv("CHRONICLES_JWT_SECRET_FILE",tc.path)
   if _,err:=stagingReadOptionsFromEnv();!errors.Is(err,errReadConfig){
    t.Fatalf("invalid key source accepted: %v",err)
   }
  })
 }
 for _,tc:=range []struct{name,value string}{
  {"short","short"},
  {"empty",""},
  {"oversize",strings.Repeat("x",4097)},
 }{
  t.Run(tc.name,func(t *testing.T){
   path:=filepath.Join(folder,"bad-"+tc.name)
   if err:=os.WriteFile(path,[]byte(tc.value),0600);err!=nil{t.Fatal(err)}
   t.Setenv("CHRONICLES_JWT_SECRET_FILE",path)
   if _,err:=stagingReadOptionsFromEnv();!errors.Is(err,errReadConfig){
    t.Fatalf("invalid content accepted: %v",err)
   }
  })
 }
}

func TestDisabledReadAPIStaysAbsent(t *testing.T) {
 h,closer,err:=configuredHandlerWithReads(context.Background(),"","",readOptions{})
 if err!=nil||closer!=nil{t.Fatalf("default server config changed: %v",err)}
 rec:=httptest.NewRecorder()
 h.ServeHTTP(rec,httptest.NewRequest(http.MethodGet,"/api/chronicles/runs",nil))
 if rec.Code!=http.StatusNotFound{t.Fatalf("read routes unexpectedly enabled: %d",rec.Code)}
}
