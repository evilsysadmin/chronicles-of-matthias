// Package readapi stages the read-only Chronicles run routes behind an
// explicit trusted token verifier. It is NOT mounted by the production API.
package readapi

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "strings"

 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore"
 "github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/legacyread"
)

// Verifier maps a cryptographically verified session token to its owner.
// Never implement this by trusting X-User, X-Owner, or an unverified JWT claim.
type Verifier interface {
 VerifyOwner(ctx context.Context, bearerToken string) (string,error)
}

// Reader is the minimum persistence surface for authenticated read routes.
type Reader interface {
 ListSummaries(ctx context.Context, ownerID string) ([]runstore.Summary,error)
 GetPublic(ctx context.Context, ownerID, runID string) (legacyread.PublicRun,error)
}

var ErrUnconfigured = errors.New("read API requires a token verifier and run reader")

// New constructs but does not register read routes. The main server MUST NOT
// call this until an actual verifier and the API parity gate are supplied.
func New(verifier Verifier, reader Reader) (http.Handler,error) {
 if verifier==nil || reader==nil {return nil,ErrUnconfigured}
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /api/chronicles/runs",func(w http.ResponseWriter,r *http.Request){
  owner,ok:=authenticatedOwner(w,r,verifier)
  if !ok {return}
  summaries,err:=reader.ListSummaries(r.Context(),owner)
  if err!=nil {writeFailure(w,err);return}
  if summaries==nil {summaries=[]runstore.Summary{}}
  writeJSON(w,http.StatusOK,struct{
   Runs []runstore.Summary `json:"runs"`
  }{Runs:summaries})
 })
 mux.HandleFunc("GET /api/chronicles/runs/{runID}",func(w http.ResponseWriter,r *http.Request){
  owner,ok:=authenticatedOwner(w,r,verifier)
  if !ok {return}
  id:=r.PathValue("runID")
  if id=="" {writeFailure(w,runstore.ErrNotFound);return}
  run,err:=reader.GetPublic(r.Context(),owner,id)
  if err!=nil {writeFailure(w,err);return}
  writeJSON(w,http.StatusOK,run)
 })
 return mux,nil
}

func authenticatedOwner(w http.ResponseWriter,r *http.Request,v Verifier)(string,bool){
 parts:=strings.Fields(r.Header.Get("Authorization"))
 if len(parts)!=2 || !strings.EqualFold(parts[0],"Bearer") || parts[1]=="" {
  unauthorized(w)
  return "",false
 }
 owner,err:=v.VerifyOwner(r.Context(),parts[1])
 if errors.Is(err,runstore.ErrUnavailable) {
  writeFailure(w,err)
  return "",false
 }
 if err!=nil || strings.TrimSpace(owner)=="" {unauthorized(w);return "",false}
 return owner,true
}

func unauthorized(w http.ResponseWriter){
 w.Header().Set("WWW-Authenticate","Bearer")
 writeJSON(w,http.StatusUnauthorized,struct{
  Detail string `json:"detail"`
 }{Detail:"No autenticado."})
}

func writeFailure(w http.ResponseWriter,err error){
 if errors.Is(err,runstore.ErrNotFound){
  writeJSON(w,http.StatusNotFound,struct{
   Detail string `json:"detail"`
  }{Detail:"Run de Chronicles no encontrada."})
  return
 }
 // Storage errors, corrupt records and unexpected backend exceptions fail
 // closed; do not expose stack traces or private database information.
 writeJSON(w,http.StatusServiceUnavailable,struct{
  Detail string `json:"detail"`
 }{Detail:"Chronicles no está disponible temporalmente."})
}

func writeJSON(w http.ResponseWriter,status int,value any){
 var buffer bytes.Buffer
 encoder:=json.NewEncoder(&buffer)
 encoder.SetEscapeHTML(false)
 if err:=encoder.Encode(value);err!=nil {
  http.Error(w,"Chronicles no está disponible temporalmente.",http.StatusServiceUnavailable)
  return
 }
 w.Header().Set("Content-Type","application/json")
 w.WriteHeader(status)
 _,_ =w.Write(bytes.TrimSuffix(buffer.Bytes(),[]byte("\n")))
}
