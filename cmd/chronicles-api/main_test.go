package main
import (
 "net/http"
 "net/http/httptest"
 "testing"
)
func TestHealth(t *testing.T){
 r:=httptest.NewRequest(http.MethodGet,"/healthz",nil)
 w:=httptest.NewRecorder()
 handler().ServeHTTP(w,r)
 if w.Code!=http.StatusOK {t.Fatalf("unexpected status %d",w.Code)}
}
func TestNoFakeGameplayAPI(t *testing.T){
 r:=httptest.NewRequest(http.MethodGet,"/api/chronicles/run",nil)
 w:=httptest.NewRecorder()
 handler().ServeHTTP(w,r)
 if w.Code!=http.StatusNotFound {t.Fatalf("unexpected status %d",w.Code)}
}
