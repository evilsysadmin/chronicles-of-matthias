package main

// The optional Identity alias client is staging-only and server-to-server.
// It never alters authentication, account IDs or save ownership.
import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
)

const rosterAliasURL = "https://id-staging.shadowops.dpdns.org/api/identity/admin-aliases"

var rosterAliasUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
var rosterNativeAlias = regexp.MustCompile(`^[a-z][a-z0-9_]{2,31}$`)

func rosterAliasCredentialValid(key string) bool {
	if len(key) != 48 || !strings.HasPrefix(key, "soa1_") {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(key[5:])
	return err == nil && len(raw) == 32 && base64.RawURLEncoding.EncodeToString(raw) == key[5:]
}

// No secret: disabled. Misconfigured secret/environment: reject startup.
// Injecting a client is only for deterministic transport tests; runtime uses
// TLS certificate validation and refuses redirects to different hosts.
func newRosterAliasResolver(environment, credential string, client *http.Client) (func(context.Context, *rosterPage), error) {
	if credential == "" {
		return nil, nil
	}
	if environment != "staging" || !rosterAliasCredentialValid(credential) {
		return nil, errors.New("invalid staging admin alias configuration")
	}
	if client == nil {
		client = &http.Client{
			Timeout: 2 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		}
	}
	return func(ctx context.Context, page *rosterPage) {
		if page == nil || len(page.Users) == 0 || len(page.Users) > adminPageSize {
			return
		}
		subjects := make([]string, 0, len(page.Users))
		accounts := make(map[string]int)
		for i := range page.Users {
			username := page.Users[i].Username
			if !strings.HasPrefix(username, identityauth.ProfilePrefix) {
				continue
			}
			subject := strings.TrimPrefix(username, identityauth.ProfilePrefix)
			if !rosterAliasUUID.MatchString(subject) {
				continue
			}
			if _, exists := accounts[subject]; exists {
				continue
			}
			accounts[subject] = i
			subjects = append(subjects, subject)
		}
		if len(subjects) == 0 {
			return
		}
		payload, err := json.Marshal(struct {
			Subjects []string `json:"subjects"`
		}{Subjects: subjects})
		if err != nil {
			return
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, rosterAliasURL, bytes.NewReader(payload))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+credential)
		resp, err := client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK || !strings.Contains(resp.Header.Get("Cache-Control"), "no-store") {
			return
		}
		media, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
		if err != nil || media != "application/json" {
			return
		}
		var data struct {
			Aliases map[string]string `json:"aliases"`
		}
		decoder := json.NewDecoder(io.LimitReader(resp.Body, 4097))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&data) != nil {
			return
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			return
		}
		for subject, alias := range data.Aliases {
			i, requested := accounts[subject]
			if requested && rosterNativeAlias.MatchString(alias) {
				page.Users[i].AccountAlias = alias
			}
		}
	}, nil
}
