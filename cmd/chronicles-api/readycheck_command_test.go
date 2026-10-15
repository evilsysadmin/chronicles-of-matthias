package main

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSeparateLivenessAndReadinessCommands(t *testing.T) {
	server:=httptest.NewServer(handler())
	defer server.Close()
	address:=strings.TrimPrefix(server.URL,"http://")
	if err:=probeAt(address,"/healthz");err!=nil {t.Fatalf("live process must pass: %v",err)}
	if err:=probeAt(address,"/readyz");err==nil {t.Fatal("unconfigured storage unexpectedly ready")}
}

func TestReadycheckAcceptsHealthyDependency(t *testing.T) {
	server:=httptest.NewServer(handlerWithReadiness(func(context.Context) error {return nil}))
	defer server.Close()
	if err:=probeAt(strings.TrimPrefix(server.URL,"http://"),"/readyz");err!=nil {
		t.Fatalf("ready service rejected: %v",err)
	}
}

func TestReadycheckRejectsFailedDependency(t *testing.T) {
	server:=httptest.NewServer(handlerWithReadiness(func(context.Context) error {return errors.New("unavailable")}))
	defer server.Close()
	if err:=probeAt(strings.TrimPrefix(server.URL,"http://"),"/readyz");err==nil {
		t.Fatal("unready service incorrectly accepted")
	}
}
