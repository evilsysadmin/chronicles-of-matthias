package main

import (
	"context"
	"errors"
	"net/http"

	"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/mongoruns"
"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/mongoaccounts"
"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/readapi"
"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/sessionverify"
)

var errPartialMongoConfig = errors.New("both Chronicles MongoDB URI and database are required")

type readOptions struct { Enabled bool; Environment string; SessionSecret []byte }
var errReadGate = errors.New("read-only routes require staging, MongoDB and session verification")

// Default remains liveness/readiness-only. No routes are opened automatically.
func configuredHandler(ctx context.Context, uri, database string) (http.Handler, func(context.Context) error, error) {
return configuredHandlerWithReads(ctx, uri, database, readOptions{})
}

func configuredHandlerWithReads(ctx context.Context, uri, database string, opts readOptions) (http.Handler, func(context.Context) error, error) {
 if opts.Enabled && (opts.Environment!="staging" || len(opts.SessionSecret)<32 || uri=="" || database=="") {return nil,nil,errReadGate}
	if uri == "" && database == "" {
		return handler(), nil, nil // alive but deliberately not ready
	}
	if uri == "" || database == "" {
		return nil, nil, errPartialMongoConfig
	}
	reader, err := mongoruns.Open(ctx, uri, database)
	if err != nil {
		return nil, nil, err
	}
	base := handlerWithReadiness(reader.Ping)
 if !opts.Enabled {return base,reader.Close,nil}
 accounts,err:=mongoaccounts.New(reader.AccountDatabase())
 if err!=nil {_=reader.Close(context.Background());return nil,nil,err}
 verifier,err:=sessionverify.New(opts.SessionSecret,accounts,nil)
 if err!=nil {_=reader.Close(context.Background());return nil,nil,err}
 reads,err:=readapi.New(verifier,reader)
 if err!=nil {_=reader.Close(context.Background());return nil,nil,err}
 routes:=http.NewServeMux()
 routes.Handle("/api/chronicles/runs",reads)
 routes.Handle("/api/chronicles/runs/",reads)
 routes.Handle("/",base)
 return routes,reader.Close,nil
}
