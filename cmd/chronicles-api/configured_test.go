package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func readinessStatus(t *testing.T, h http.Handler) int {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	return rec.Code
}

func TestMongoConfigurationIsFailClosed(t *testing.T) {
	ctx := context.Background()
	h, closer, err := configuredHandler(ctx, "", "")
	if err != nil || closer != nil || readinessStatus(t,h) != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured server must be live but not ready: close=%v err=%v", closer != nil, err)
	}
	for _, pair := range [][2]string{{"mongodb://localhost:27017",""},{"","chronicles"}} {
		_, _, err := configuredHandler(ctx, pair[0], pair[1])
		if !errors.Is(err,errPartialMongoConfig) {
			t.Fatalf("partly configured Mongo was accepted: %v",err)
		}
	}
}

func TestMongoBackedReadinessTracksConnection(t *testing.T) {
	uri := os.Getenv("CHRONICLES_TEST_MONGODB_URI")
	if uri == "" { t.Skip("requires Mongo integration service") }
	ctx,cancel := context.WithTimeout(context.Background(),20*time.Second)
	defer cancel()
	h,closer,err := configuredHandler(ctx,uri,fmt.Sprintf("chronicles_ready_%d",time.Now().UnixNano()))
	if err != nil { t.Fatal(err) }
	defer func(){ _ = closer(context.Background()) }()
	if got := readinessStatus(t,h); got != http.StatusOK { t.Fatalf("reachable Mongo must be ready, got %d",got) }
	if err := closer(ctx); err != nil { t.Fatal(err) }
	if got := readinessStatus(t,h); got != http.StatusServiceUnavailable {t.Fatalf("disconnected Mongo must not be ready, got %d",got)}
}
