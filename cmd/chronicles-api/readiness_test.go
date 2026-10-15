package main

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestReadinessFailsClosedWithoutStorage(t *testing.T) {
 rec:=httptest.NewRecorder()
 handler().ServeHTTP(rec,httptest.NewRequest("GET","/readyz",nil))
 if rec.Code!=http.StatusServiceUnavailable {t.Fatalf("got %d, want 503",rec.Code)}
 if rec.Body.String()!=`{"status":"not_ready"}` {t.Fatalf("unexpected body: %s",rec.Body.String())}
}

func TestReadinessReflectsDependencyCheck(t *testing.T) {
 for _,tc:=range []struct{name string;check func(context.Context)error;want int}{
  {"healthy",func(context.Context)error{return nil},http.StatusOK},
  {"unavailable",func(context.Context)error{return errors.New("storage unavailable")},http.StatusServiceUnavailable},
 } {
  t.Run(tc.name,func(t *testing.T){
   rec:=httptest.NewRecorder()
   handlerWithReadiness(tc.check).ServeHTTP(rec,httptest.NewRequest("GET","/readyz",nil))
   if rec.Code!=tc.want {t.Fatalf("got %d, want %d",rec.Code,tc.want)}
  })
 }
}

func TestLivenessIndependentOfReadiness(t *testing.T) {
 rec:=httptest.NewRecorder()
 handler().ServeHTTP(rec,httptest.NewRequest("GET","/healthz",nil))
 if rec.Code!=http.StatusOK {t.Fatalf("liveness changed: %d",rec.Code)}
}

func TestReadinessPropagatesRequestCancellation(t *testing.T) {
 ctx,cancel:=context.WithCancel(context.Background())
 cancel()
 rec:=httptest.NewRecorder()
 handlerWithReadiness(func(ctx context.Context) error {
  if ctx.Err()==nil {t.Error("dependency check did not receive cancellation")}
  return ctx.Err()
 }).ServeHTTP(rec,httptest.NewRequest("GET","/readyz",nil).WithContext(ctx))
 if rec.Code!=http.StatusServiceUnavailable {t.Fatalf("got %d, want 503",rec.Code)}
}
