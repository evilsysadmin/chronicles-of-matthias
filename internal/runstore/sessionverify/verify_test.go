package sessionverify

import (
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "errors"
 "strings"
 "testing"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
)

type accountsStub struct {
 version int64
 found bool
 unavailable bool
 calls int
}
func (a *accountsStub) CurrentSession(context.Context,string)(int64,bool,error){
 a.calls++
 if a.unavailable {return 0,false,errors.New("database offline")}
 return a.version,a.found,nil
}

func signTestToken(secret []byte,header,payload map[string]any) string {
 headBytes,_:=json.Marshal(header)
 bodyBytes,_:=json.Marshal(payload)
 head:=base64.RawURLEncoding.EncodeToString(headBytes)
 body:=base64.RawURLEncoding.EncodeToString(bodyBytes)
 unsigned:=head+"."+body
 mac:=hmac.New(sha256.New,secret)
 _,_=mac.Write([]byte(unsigned))
 return unsigned+"."+base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// Exact PyJWT 2.15 output from the Chess Studio native Go
// sessionauth parity test at 2026-10-05T12:00:00Z.
const pythonAliceToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSIsInB1cnBvc2UiOiJzZXNzaW9uIiwic3YiOjMsImV4cCI6MTc5Mzc5MzYwMH0.j_hwcd9CVLR9mTzl3Azlwm9xs3fxQbzBEj11hyK1fak"

func TestVerifyExactExistingPythonSession(t *testing.T) {
 now:=time.Date(2026,10,5,12,0,0,0,time.UTC)
 account:=&accountsStub{version:3,found:true}
 v,err:=New([]byte(strings.Repeat("s",32)),account,func()time.Time{return now})
 if err!=nil{t.Fatal(err)}
 got,err:=v.VerifyOwner(context.Background(),pythonAliceToken)
 if err!=nil||got!="alice"{t.Fatalf("PyJWT source token rejected: %q %v",got,err)}
 if account.calls!=1{t.Fatalf("account revocation not checked: %d",account.calls)}
 account.version=4 // Password reset, logout-all or session rotation.
 if _,err:=v.VerifyOwner(context.Background(),pythonAliceToken);!errors.Is(err,ErrUnauthorized){
  t.Fatalf("revoked session accepted: %v",err)
 }
 account.version=3
 account.found=false
 if _,err:=v.VerifyOwner(context.Background(),pythonAliceToken);!errors.Is(err,ErrUnauthorized){
  t.Fatalf("deleted/disabled account accepted: %v",err)
 }
 account.found=true
 account.unavailable=true
 if _,err:=v.VerifyOwner(context.Background(),pythonAliceToken);!errors.Is(err,runstore.ErrUnavailable){
  t.Fatalf("account store outage misclassified: %v",err)
 }
}

func TestVerifyRejectsUntrustedAndWrongPurposeTokens(t *testing.T){
 now:=time.Date(2026,10,5,12,0,0,0,time.UTC)
 secret:=[]byte(strings.Repeat("s",32))
 account:=&accountsStub{version:3,found:true}
 v,err:=New(secret,account,func()time.Time{return now})
 if err!=nil{t.Fatal(err)}
 base:=map[string]any{"sub":"alice","purpose":"session","sv":3,"exp":now.Add(time.Hour).Unix()}
 for _,tc:=range []struct{
  name string
  token string
 }{
  {"tampered",pythonAliceToken+"x"},
  {"bad secret",signTestToken([]byte(strings.Repeat("x",32)),map[string]any{"alg":"HS256","typ":"JWT"},base)},
  {"unsigned algorithm",signTestToken(secret,map[string]any{"alg":"none"},base)},
  {"reset token",signTestToken(secret,map[string]any{"alg":"HS256"},map[string]any{"sub":"alice","purpose":"password_reset","sv":3,"exp":now.Add(time.Hour).Unix()})},
  {"expired",signTestToken(secret,map[string]any{"alg":"HS256"},map[string]any{"sub":"alice","purpose":"session","sv":3,"exp":now.Add(-time.Second).Unix()})},
  {"negative version",signTestToken(secret,map[string]any{"alg":"HS256"},map[string]any{"sub":"alice","purpose":"session","sv":-1,"exp":now.Add(time.Hour).Unix()})},
  {"missing expiry",signTestToken(secret,map[string]any{"alg":"HS256"},map[string]any{"sub":"alice","purpose":"session","sv":3})},
  {"missing subject",signTestToken(secret,map[string]any{"alg":"HS256"},map[string]any{"purpose":"session","sv":3,"exp":now.Add(time.Hour).Unix()})},
  {"malformed","not.a.jwt"},
 }{
  t.Run(tc.name,func(t *testing.T){
   before:=account.calls
   if _,err:=v.VerifyOwner(context.Background(),tc.token);!errors.Is(err,ErrUnauthorized){
    t.Fatalf("untrusted JWT accepted: %v",err)
   }
   if account.calls!=before{t.Fatal("database called before token validation")}
  })
 }
}

func TestVerifyLegacyMissingSessionVersionDefaultsToZero(t *testing.T){
 now:=time.Date(2026,10,5,12,0,0,0,time.UTC)
 secret:=[]byte(strings.Repeat("s",32))
 account:=&accountsStub{version:0,found:true}
 v,_:=New(secret,account,func()time.Time{return now})
 token:=signTestToken(secret,map[string]any{"alg":"HS256","typ":"JWT"},map[string]any{
  "sub":"legacy","purpose":"session","exp":now.Add(time.Hour).Unix(),
 })
 if owner,err:=v.VerifyOwner(context.Background(),token);err!=nil||owner!="legacy"{
  t.Fatalf("valid legacy sv=0 session rejected: %q %v",owner,err)
 }
 account.version=1
 if _,err:=v.VerifyOwner(context.Background(),token);!errors.Is(err,ErrUnauthorized){
  t.Fatalf("revoked legacy session accepted: %v",err)
 }
}

func TestVerifierRequiresExplicitStrongSecretAndAccountProvider(t *testing.T){
 account:=&accountsStub{found:true}
 if _,err:=New([]byte("short"),account,nil);!errors.Is(err,ErrMisconfigured){
  t.Fatalf("short secret accepted: %v",err)
 }
 if _,err:=New([]byte(strings.Repeat("x",32)),nil,nil);!errors.Is(err,ErrMisconfigured){
  t.Fatalf("missing account verification accepted: %v",err)
 }
}
