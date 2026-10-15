package main

import (
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestHealthzResponseContract(t *testing.T) {
 for _,tc:=range []struct{method string;want int}{
  {"GET",http.StatusOK},
  {"HEAD",http.StatusMethodNotAllowed},
  {"POST",http.StatusMethodNotAllowed},
 } {
  t.Run(tc.method,func(t *testing.T){
   rec:=httptest.NewRecorder()
   handler().ServeHTTP(rec,httptest.NewRequest(tc.method,"/healthz",nil))
   if rec.Code!=tc.want {t.Fatalf("status %d, want %d",rec.Code,tc.want)}
   if tc.method=="GET" {
    if got:=rec.Header().Get("Content-Type");got!="application/json" {t.Fatalf("content type %q",got)}
    if got:=rec.Body.String();got!=`{"status":"ok"}` {t.Fatalf("body %q",got)}
   }
  })
 }
}
func TestUnknownRouteNotHealthy(t *testing.T) {
 rec:=httptest.NewRecorder()
 handler().ServeHTTP(rec,httptest.NewRequest("GET","/readyz",nil))
 if rec.Code!=http.StatusNotFound {t.Fatalf("readiness must not be claimed before implementation: %d",rec.Code)}
}
