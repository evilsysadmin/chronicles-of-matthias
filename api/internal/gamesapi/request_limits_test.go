package gamesapi

import (
	"context"
	"strings"
	"testing"
)

type baseAccountsFixture struct{}

func (baseAccountsFixture) AuthState(context.Context, string) (bool, int64, error) {
	return false, 0, nil
}

func TestSharedBaseRequiresAccountsAndJWTButNoLegacyGameStore(t *testing.T) {
	const secret = "0123456789abcdef0123456789abcdef"
	if _, err := New(Config{JWTSecret: secret}); err == nil || !strings.Contains(err.Error(), "accounts") {
		t.Fatalf("missing account provider should fail closed: %v", err)
	}
	if _, err := New(Config{Accounts: baseAccountsFixture{}}); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("missing JWT secret should fail closed: %v", err)
	}
	base, err := New(Config{Accounts: baseAccountsFixture{}, JWTSecret: secret})
	if err != nil || base == nil || base.accounts == nil || len(base.secret) == 0 {
		t.Fatalf("shared HTTP base could not initialize independently: %v", err)
	}
}

func TestMaxRequestBodyBytesRemainsOneMiB(t *testing.T) {
	if MaxRequestBodyBytes != 1<<20 {
		t.Fatalf("MaxRequestBodyBytes = %d; expected 1048576", MaxRequestBodyBytes)
	}
}
