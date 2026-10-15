package runstore

import (
 "context"
 "errors"
 "testing"
)

func TestStoreErrorsSupportWrapping(t *testing.T) {
 for _,sentinel:=range []error{ErrNotFound,ErrConflict,ErrUnavailable} {
  wrapped:=errors.Join(sentinel,errors.New("detail"))
  if !errors.Is(wrapped,sentinel) {t.Fatalf("sentinel lost: %v",sentinel)}
 }
}

// This is intentionally a compile-time contract test, not a fake MongoDB
// integration test. Concrete implementations will need concurrency and
// cross-owner isolation tests before any live route is switched.
type stubStore struct{}
func (stubStore) Ping(context.Context)error{return nil}
func (stubStore) List(context.Context,string)([]Run,error){return nil,nil}
func (stubStore) Get(context.Context,string,string)(Run,error){return Run{},ErrNotFound}
func (stubStore) Create(context.Context,string,string,Run)(Run,error){return Run{},ErrUnavailable}
func (stubStore) Checkpoint(context.Context,string,string,int64,string,[]byte)(Run,error){return Run{},ErrUnavailable}
func (stubStore) Delete(context.Context,string,string)error{return ErrNotFound}
var _ Store = stubStore{}
