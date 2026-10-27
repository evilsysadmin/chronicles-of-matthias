package main

import "testing"

func TestRegistrationAllowedWithInvitePolicy(t *testing.T) {
	tests := []struct {
		name        string
		environment string
		enabled     bool
		inviteCode  string
		want        bool
	}{
		{"staging absent", "staging", true, "", false},
		{"staging whitespace", "staging", true, "  ", false},
		{"staging valid", "staging", true, "secret-code", true},
		{"production absent", "production", true, "", false},
		{"production valid", "production", true, "secret-code", true},
		{"production disabled", "production", false, "secret-code", false},
		{"stage alias", "stage", true, "", false},
		{"prod alias", "prod", true, "", false},
		{"case insensitive", " PRODUCTION ", true, "", false},
		{"CI keeps flag", "ci", true, "", true},
		{"local keeps flag", "local", true, "", true},
		{"local disabled", "local", false, "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := registrationAllowed(tt.environment, tt.enabled, tt.inviteCode); got != tt.want {
				t.Fatalf("registrationAllowed(%q, %v, <redacted>) = %v, want %v", tt.environment, tt.enabled, got, tt.want)
			}
		})
	}
}
