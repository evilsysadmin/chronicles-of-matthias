package main

import (
	"context"
	"errors"
	"net/http"

	"github.com/evilsysadmin/chronicles-of-matthias/internal/runstore/mongoruns"
)

var errPartialMongoConfig = errors.New("both Chronicles MongoDB URI and database are required")

// configuredHandler wires only the dependency readiness check. Run endpoints
// remain disabled until Python/Go save compatibility is independently proven.
func configuredHandler(ctx context.Context, uri, database string) (http.Handler, func(context.Context) error, error) {
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
	return handlerWithReadiness(reader.Ping), reader.Close, nil
}
