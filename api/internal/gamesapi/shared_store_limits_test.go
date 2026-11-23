package gamesapi

import (
	"context"
	"errors"
	"testing"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/gamestore"
)

func TestReadOnlyStoreFailsClosed(t *testing.T) {
	store := readOnlyStore{}
	ctx := context.Background()
	records, err := store.ListSummariesByOwner(ctx, "owner", 10)
	if records != nil || !errors.Is(err, gamestore.ErrUnavailable) {
		t.Fatalf("ListSummariesByOwner = %v, %v; expected unavailable", records, err)
	}
	row, found, err := store.GetDocumentForOwner(ctx, "run", "owner")
	if row != nil || found || !errors.Is(err, gamestore.ErrUnavailable) {
		t.Fatalf("GetDocumentForOwner = %v, %v, %v; expected unavailable", row, found, err)
	}
	deleted, err := store.DeleteForOwner(ctx, "run", "owner")
	if deleted || !errors.Is(err, gamestore.ErrUnavailable) {
		t.Fatalf("DeleteForOwner = %v, %v; expected unavailable", deleted, err)
	}
}

func TestMaxRequestBodyBytesRemainsOneMiB(t *testing.T) {
	if MaxRequestBodyBytes != 1<<20 {
		t.Fatalf("MaxRequestBodyBytes = %d; expected 1048576", MaxRequestBodyBytes)
	}
}
