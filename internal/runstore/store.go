package runstore

import (
 "context"
 "errors"
)

var (
 ErrNotFound = errors.New("run not found")
 ErrConflict = errors.New("run version conflict")
 ErrUnavailable = errors.New("run storage unavailable")
)

// Run is the persisted envelope. State is an opaque JSON checkpoint until
// the Python-to-Go compatibility corpus establishes a stable schema.
type Run struct {
 ID string
 OwnerID string
 WorldVersion int64
 State []byte
}

// Store is the persistence boundary for authenticated Chronicles runs.
// Implementations MUST scope every lookup and mutation by ownerID.
// expectedVersion enforces optimistic concurrency; a stale writer MUST fail
// with ErrConflict and MUST NOT overwrite the stored checkpoint.
// idempotencyKey prevents duplicate effects on retried writes.
type Store interface {
 Ping(ctx context.Context) error
 List(ctx context.Context, ownerID string) ([]Run, error)
 Get(ctx context.Context, ownerID, runID string) (Run, error)
 Create(ctx context.Context, ownerID, idempotencyKey string, run Run) (Run, error)
 Checkpoint(ctx context.Context, ownerID, runID string, expectedVersion int64, idempotencyKey string, state []byte) (Run, error)
 Delete(ctx context.Context, ownerID, runID string) error
}
