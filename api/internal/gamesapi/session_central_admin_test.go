package gamesapi

import (
	"testing"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
)

func TestCentralIdentityAdminRequiresExplicitProductGrant(t *testing.T) {
	const approved = "11111111-1111-4111-8111-111111111111"
	const stranger = "22222222-2222-4222-8222-222222222222"
	owner := identityauth.ProfilePrefix + approved
	other := identityauth.ProfilePrefix + stranger
	h := &SessionHandler{allAdmins: true, admins: map[string]bool{"evilsysadmin": true}}

	if !h.isAdmin("evilsysadmin") {
		t.Fatal("legacy owner lost access")
	}
	if h.isAdmin(owner) || h.isAdmin(other) {
		t.Fatal("legacy wildcard or owner name must not grant central Identity privileges")
	}
	h.admins[owner] = true
	if !h.isAdmin(owner) {
		t.Fatal("explicit, server-side product grant must authorize verified central profile")
	}
	if h.isAdmin(other) || h.isAdmin(identityauth.ProfilePrefix+"not-a-uuid") {
		t.Fatal("grant must not affect other subjects or malformed reserved profiles")
	}
	if h.isAdmin("shadowops:other:"+approved) {
		t.Fatal("staging privilege must not be honored in another namespace")
	}
}
