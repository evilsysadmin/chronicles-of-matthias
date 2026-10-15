// Package sessionverify ports the existing Chess Studio HS256 browser session
// verification contract without importing Chess Studio or trusting JWT claims
// without signature and current-account checks.
package sessionverify

import (
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "errors"
 "strings"
 "time"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
)

var (
 ErrUnauthorized = errors.New("invalid or revoked Chronicles session")
 ErrMisconfigured = errors.New("Chronicles session verifier is not configured")
)

// Accounts MUST consult the authoritative account database. found is true
// only for an existing enabled account; version is its current session
// revision, which changes on logout-all, password reset and revocation.
type Accounts interface {
 CurrentSession(ctx context.Context, username string) (version int64, found bool, err error)
}

type Verifier struct {
 secret []byte
 accounts Accounts
 now func() time.Time
}

// New never falls back to the Chess Studio development signing secret.
func New(secret []byte, accounts Accounts, now func()time.Time)(*Verifier,error){
 if len(secret)<32 || accounts==nil {return nil,ErrMisconfigured}
 if now==nil{now=time.Now}
 return &Verifier{
  secret:append([]byte(nil),secret...),
  accounts:accounts,
  now:now,
 },nil
}

type header struct {
 Algorithm string `json:"alg"`
 Type string `json:"typ"`
}
type claims struct {
 Subject string `json:"sub"`
 Purpose string `json:"purpose"`
 Version *int64 `json:"sv"`
 ExpiresAt int64 `json:"exp"`
}

// VerifyOwner validates the signature, expiry, purpose, account existence and
// current session version. The owner must never be taken from client headers.
func (v *Verifier) VerifyOwner(ctx context.Context, raw string)(string,error){
 if v==nil||len(raw)<20||len(raw)>4096 {return "",ErrUnauthorized}
 parts:=strings.Split(raw,".")
 if len(parts)!=3 {return "",ErrUnauthorized}
 headerBytes,err:=base64.RawURLEncoding.DecodeString(parts[0])
 if err!=nil||len(headerBytes)>2048{return "",ErrUnauthorized}
 var h header
 if json.Unmarshal(headerBytes,&h)!=nil||h.Algorithm!="HS256"||
  (h.Type!=""&&!strings.EqualFold(h.Type,"JWT")){return "",ErrUnauthorized}
 signature,err:=base64.RawURLEncoding.DecodeString(parts[2])
 if err!=nil||len(signature)!=sha256.Size{return "",ErrUnauthorized}
 mac:=hmac.New(sha256.New,v.secret)
 _,_=mac.Write([]byte(parts[0]+"."+parts[1]))
 if !hmac.Equal(signature,mac.Sum(nil)){return "",ErrUnauthorized}
 payloadBytes,err:=base64.RawURLEncoding.DecodeString(parts[1])
 if err!=nil||len(payloadBytes)>2048 {return "",ErrUnauthorized}
 var payload claims
 if json.Unmarshal(payloadBytes,&payload)!=nil ||
  strings.TrimSpace(payload.Subject)=="" ||
  (payload.Purpose!=""&&payload.Purpose!="session") ||
  payload.ExpiresAt<=0 ||
  !v.now().Before(time.Unix(payload.ExpiresAt,0)) {return "",ErrUnauthorized}
 version:=int64(0)
 if payload.Version!=nil{
  version=*payload.Version
  if version<0{return "",ErrUnauthorized}
 }
 current,found,err:=v.accounts.CurrentSession(ctx,payload.Subject)
 if err!=nil{return "",runstore.ErrUnavailable}
 if !found||current!=version||current<0{return "",ErrUnauthorized}
 return payload.Subject,nil
}
