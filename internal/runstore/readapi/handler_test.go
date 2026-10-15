package readapi

import (
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/legacyread"
)

type fakeVerifier struct{}
func (fakeVerifier) VerifyOwner(_ context.Context,token string)(string,error){
 switch token {
 case "verified-alice":return "alice",nil
 case "verified-bob":return "bob",nil
 case "store-offline":return "",runstore.ErrUnavailable
 default:return "",errors.New("signature invalid")
 }
}
type fakeReader struct{
 gotOwner string
 gotRun string
 fail error
}
func (f *fakeReader) ListSummaries(_ context.Context,owner string)([]runstore.Summary,error){
 f.gotOwner=owner
 if f.fail!=nil{return nil,f.fail}
 if owner=="bob"{return nil,nil}
 return []runstore.Summary{{RunID:"owned",CurrentMapID:"crypt",Status:"active",WorldVersion:2,UpdatedAtMs:1791192000125}},nil
}
func (f *fakeReader) GetPublic(_ context.Context,owner,id string)(legacyread.PublicRun,error){
 f.gotOwner=owner
 f.gotRun=id
 if f.fail!=nil{return legacyread.PublicRun{},f.fail}
 if owner!="alice"||id!="owned"{return legacyread.PublicRun{},runstore.ErrNotFound}
 return legacyread.PublicRun{
  RunID:"owned",Seed:417,CurrentMapID:"crypt",
  ContentVersion:11,ManifestRevision:"rev",Status:"active",
  ConsumedContentIDs:[]string{},ClaimedRewards:[]string{},
  WorldFlags:map[string]any{"door":true},Inventory:map[string]any{},
  Quests:map[string]any{},
 },nil
}
func request(h http.Handler,method,path,authorization,claimedOwner string)*httptest.ResponseRecorder{
 rec:=httptest.NewRecorder()
 req:=httptest.NewRequest(method,path,nil)
 if authorization!=""{req.Header.Set("Authorization",authorization)}
 if claimedOwner!=""{req.Header.Set("X-Owner-Id",claimedOwner)}
 h.ServeHTTP(rec,req)
 return rec
}

func TestReadAPIRequiresServerVerifiedIdentity(t *testing.T){
 data:=&fakeReader{}
 h,err:=New(fakeVerifier{},data)
 if err!=nil{t.Fatal(err)}
 for _,tc:=range []struct{name,token,spoof string}{
  {"missing token","","alice"},
  {"spoofed owner","", "bob"},
  {"untrusted bearer","Bearer fake-token","alice"},
  {"unsupported scheme","Basic verified-alice",""},
  {"invalid bearer form","Bearer verified-alice extra",""},
 }{
  t.Run(tc.name,func(t *testing.T){
   rec:=request(h,"GET","/api/chronicles/runs",tc.token,tc.spoof)
   if rec.Code!=http.StatusUnauthorized{t.Fatalf("got %d, want 401",rec.Code)}
   if rec.Header().Get("WWW-Authenticate")!="Bearer"{t.Fatal("missing challenge")}
  })
 }
 if data.gotOwner!="" {t.Fatal("storage reached without validated identity")}
 rec:=request(h,"GET","/api/chronicles/runs","Bearer verified-alice","bob")
 if rec.Code!=http.StatusOK||data.gotOwner!="alice"{t.Fatalf("spoofed owner accepted: %d / %s",rec.Code,data.gotOwner)}
 var list struct{Runs []runstore.Summary `json:"runs"`}
 if err:=json.Unmarshal(rec.Body.Bytes(),&list);err!=nil{t.Fatal(err)}
 if len(list.Runs)!=1||list.Runs[0].RunID!="owned"{t.Fatalf("unexpected list: %#v",list)}
 bob:=request(h,"GET","/api/chronicles/runs","Bearer verified-bob","alice")
 if bob.Code!=200||strings.TrimSpace(bob.Body.String())!=`{"runs":[]}` {
  t.Fatalf("empty owner list contract mismatch: %d %s",bob.Code,bob.Body.String())
 }
}

func TestReadAPIHidesOtherOwnersAndDoesNotExposeWrites(t *testing.T){
 data:=&fakeReader{}
 h,err:=New(fakeVerifier{},data)
 if err!=nil{t.Fatal(err)}
 alice:=request(h,"GET","/api/chronicles/runs/owned","Bearer verified-alice","bob")
 if alice.Code!=200||data.gotOwner!="alice"||data.gotRun!="owned"{
  t.Fatalf("expected owned save: %d %s",alice.Code,alice.Body.String())
 }
 if !strings.Contains(alice.Body.String(),`"worldFlags":{"door":true}`){t.Fatalf("checkpoint missing: %s",alice.Body.String())}
 if strings.Contains(alice.Body.String(),`"owner"`) {t.Fatalf("private owner leaked: %s",alice.Body.String())}
 bob:=request(h,"GET","/api/chronicles/runs/owned","Bearer verified-bob","alice")
 if bob.Code!=http.StatusNotFound||strings.Contains(bob.Body.String(),"alice"){
  t.Fatalf("cross-owner response incorrect: %d %s",bob.Code,bob.Body.String())
 }
 for _,tc:=range []struct{method,path string;want int}{
  {"POST","/api/chronicles/runs",http.StatusMethodNotAllowed},
  {"PUT","/api/chronicles/runs/owned/checkpoint",http.StatusNotFound},
  {"GET","/api/chronicles/runs/owned/bootstrap",http.StatusNotFound},
  {"DELETE","/api/chronicles/runs/owned",http.StatusMethodNotAllowed},
 }{
  rec:=request(h,tc.method,tc.path,"Bearer verified-alice","")
  if rec.Code!=tc.want{t.Fatalf("%s %s got %d want %d",tc.method,tc.path,rec.Code,tc.want)}
 }
}

func TestReadAPIFailsClosedOnBackendErrors(t *testing.T){
 data:=&fakeReader{fail:runstore.ErrUnavailable}
 h,err:=New(fakeVerifier{},data)
 if err!=nil{t.Fatal(err)}
 for _,path:=range []string{"/api/chronicles/runs","/api/chronicles/runs/owned"}{
  rec:=request(h,"GET",path,"Bearer verified-alice","")
  if rec.Code!=http.StatusServiceUnavailable{t.Fatalf("%s returned %d",path,rec.Code)}
  if strings.Contains(rec.Body.String(),"database")||strings.Contains(rec.Body.String(),"stack"){
   t.Fatalf("internal details leaked: %s",rec.Body.String())
  }
 }
 data.fail=legacyread.ErrCorruptRun
 if rec:=request(h,"GET","/api/chronicles/runs/owned","Bearer verified-alice","");rec.Code!=503{
  t.Fatalf("corrupt save must fail closed: %d",rec.Code)
 }
 if _,err:=New(nil,data);!errors.Is(err,ErrUnconfigured){t.Fatalf("nil auth accepted: %v",err)}
 if _,err:=New(fakeVerifier{},nil);!errors.Is(err,ErrUnconfigured){t.Fatalf("nil reader accepted: %v",err)}
}

func TestReadAPIAccountOutageReturnsUnavailable(t *testing.T){
 h,err:=New(fakeVerifier{},&fakeReader{})
 if err!=nil{t.Fatal(err)}
 rec:=request(h,"GET","/api/chronicles/runs","Bearer store-offline","")
 if rec.Code!=http.StatusServiceUnavailable {
  t.Fatalf("account storage outage must fail closed with 503, got %d",rec.Code)
 }
 if rec.Header().Get("WWW-Authenticate")!=""{
  t.Fatal("storage outage must not masquerade as invalid credentials")
 }
}
