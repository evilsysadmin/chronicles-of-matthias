package main

import (
 "context"
 "fmt"
 "log"
 "net/http"
 "os"
 "time"
)

func healthcheck() error { return probeAt("127.0.0.1:8080", "/healthz") }
func readinesscheck() error { return probeAt("127.0.0.1:8080", "/readyz") }

// probeAt reads a complete HTTP response; a single TCP Read is not
// guaranteed to contain the complete status line.
func probeAt(address, path string) error {
 ctx,cancel:=context.WithTimeout(context.Background(),2*time.Second)
 defer cancel()
 req,err:=http.NewRequestWithContext(ctx,http.MethodGet,"http://"+address+path,nil)
 if err!=nil{return err}
 client:=&http.Client{Timeout:2*time.Second,Transport:&http.Transport{
  Proxy:nil, DisableKeepAlives:true,
 }}
 response,err:=client.Do(req)
 if err!=nil{return err}
 defer response.Body.Close()
 if response.StatusCode!=http.StatusOK{return fmt.Errorf("%s returned HTTP %d",path,response.StatusCode)}
 return nil
}
func handler() http.Handler {
 return handlerWithReadiness(nil)
}

// handlerWithReadiness keeps liveness separate from dependency readiness.
// Until a storage check is wired, readiness fails closed.
func handlerWithReadiness(check func(context.Context) error) http.Handler {
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /healthz",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");w.Write([]byte("{\"status\":\"ok\"}"))})
 mux.HandleFunc("GET /readyz",func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Content-Type","application/json")
  if check==nil {w.WriteHeader(http.StatusServiceUnavailable);w.Write([]byte(`{"status":"not_ready"}`));return}
  ctx,cancel:=context.WithTimeout(r.Context(),2*time.Second)
  defer cancel()
  if err:=check(ctx);err!=nil {w.WriteHeader(http.StatusServiceUnavailable);w.Write([]byte(`{"status":"not_ready"}`));return}
  w.Write([]byte(`{"status":"ready"}`))
 })
 return mux
}
func main(){
 if len(os.Args)==2 {
  var err error
  switch os.Args[1] {
  case "healthcheck":err=healthcheck()
  case "readycheck":err=readinesscheck()
  default:log.Fatal("usage: chronicles-api [healthcheck|readycheck]")
  }
  if err!=nil {log.Fatal(err)}
  return
 }
 if len(os.Args)!=1 {log.Fatal("usage: chronicles-api [healthcheck|readycheck]")}
 initCtx,cancel:=context.WithTimeout(context.Background(),8*time.Second)
 defer cancel()
 app,closeStore,err:=configuredHandler(initCtx,os.Getenv("CHRONICLES_MONGODB_URI"),os.Getenv("CHRONICLES_MONGODB_DATABASE"))
 if err!=nil {log.Fatalf("MongoDB startup configuration or connection failed: %v",err)}
 if closeStore!=nil {defer func(){_ =closeStore(context.Background())}()}
 server:=&http.Server{Addr:":8080",Handler:app,ReadHeaderTimeout:5*time.Second}
 log.Fatal(server.ListenAndServe())
}
