package main

import (
	"slices"
	"testing"
)

func TestOwnerIsAlwaysAdmin(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "")
	if got := adminUsernames(); !slices.Equal(got, []string{"evilsysadmin"}) {
		t.Fatalf("got %v", got)
	}
	t.Setenv("ADMIN_USERNAMES", "alice, bob")
	if got := adminUsernames(); !slices.Equal(got, []string{"alice", "bob", "evilsysadmin"}) {
		t.Fatalf("got %v", got)
	}
	t.Setenv("ADMIN_USERNAMES", "EvilSysAdmin")
	if got := adminUsernames(); !slices.Equal(got, []string{"EvilSysAdmin"}) {
		t.Fatalf("got %v", got)
	}
}
