package runstore

import (
 "bytes"
 "encoding/json"
 "errors"
 "strings"
)

var ErrInvalidWrite = errors.New("invalid run write")

// ValidateCreateBoundary rejects malformed identities and checkpoints before
// invoking a storage implementation. The authenticated owner is supplied by
// the server; never copy OwnerID from a client payload.
func ValidateCreateBoundary(ownerID, key string, run Run) error {
 if strings.TrimSpace(ownerID)=="" || strings.TrimSpace(key)=="" ||
    strings.TrimSpace(run.ID)=="" || run.OwnerID!=ownerID ||
    run.WorldVersion!=0 {
  return ErrInvalidWrite
 }
 return validateState(run.State)
}

// ValidateCheckpointBoundary rejects invalid inputs before a CAS mutation.
// A missing key must never silently disable replay protection.
func ValidateCheckpointBoundary(ownerID, runID string, expectedVersion int64, key string, state []byte) error {
 if strings.TrimSpace(ownerID)=="" || strings.TrimSpace(runID)=="" ||
    strings.TrimSpace(key)=="" || expectedVersion<0 {
  return ErrInvalidWrite
 }
 return validateState(state)
}

func validateState(state []byte) error {
 if len(state)==0 || len(state)>2<<20 || !json.Valid(state) {
  return ErrInvalidWrite
 }
 dec:=json.NewDecoder(bytes.NewReader(state))
 var payload any
 if err:=dec.Decode(&payload);err!=nil {return ErrInvalidWrite}
 if _,ok:=payload.(map[string]any);!ok {return ErrInvalidWrite}
 return nil
}
