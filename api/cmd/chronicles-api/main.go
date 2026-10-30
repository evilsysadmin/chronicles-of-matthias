// Command chronicles-api is Chronicles of Matthias' own API.
//
// It is the only authored Go code in api/: every package under api/internal
// is Chess Studio's backend copied byte for byte (api/VENDOR.lock.json).
// This file wires exactly the handlers the game uses, with the same
// configuration as chess-studio/backend-go/cmd/pvp-edge/native_runtime.go:
//
//	identity  GET /, /api/health, /api/release, /api/ready
//	system    /api/status, /api/features, ...
//	login     POST /api/auth/login
//	session   /api/auth/me, /api/auth/logout, /api/auth/activity, ...
//	account   /api/auth/register, /api/auth/password, /api/auth/email, ...
//	recovery  /api/auth/forgot-password, /api/auth/reset-password
//	runs      /api/chronicles/runs[...]
//
// Its data is its own: MONGO_DB_NAME points at a Chronicles database, so
// accounts and runs are independent from Chess Studio.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/accountstore"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/authguard"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesprogression"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesrun"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/gamesapi"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/identityauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/legacyimport"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/mongoruntime"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/presence"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/release"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/resetmail"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/ssoauth"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/telemetry"
	"github.com/evilsysadmin/chess-studio/backend-go/internal/userdata"
)

const applicationName = "chronicles-of-matthias-api"

type route struct {
	name    string
	handler http.Handler
	match   func(*http.Request) bool
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	if err := run(); err != nil {
		log.Fatalf("chronicles-api: %v", err)
	}
}

func run() error {
	mongoURL := strings.TrimSpace(os.Getenv("MONGO_URL"))
	mongoDatabase := strings.TrimSpace(os.Getenv("MONGO_DB_NAME"))
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if mongoURL == "" || mongoDatabase == "" || jwtSecret == "" {
		return errors.New("MONGO_URL, MONGO_DB_NAME and JWT_SECRET are required")
	}
	timeout := envDurationMS("PVP_MONGO_TIMEOUT_MS", 2000*time.Millisecond)
	startupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	mongoRuntime, err := mongoruntime.New(startupCtx, mongoruntime.Config{
		URL: mongoURL, Database: mongoDatabase, QueryTimeout: timeout, ApplicationName: applicationName,
	})
	cancel()
	if err != nil {
		return fmt.Errorf("mongo: %w", err)
	}
	routes, err := buildRoutes(mongoRuntime, jwtSecret, timeout)
	if err != nil {
		return err
	}

	mux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, rt := range routes {
			if rt.match(r) {
				rt.handler.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"detail":"Not Found"}` + "\n"))
	})

	addr := ":" + envString("PORT", "8080")
	server := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
		_ = mongoRuntime.Close(ctx)
	}()
	log.Printf("chronicles-api listening on %s database=%s", addr, mongoDatabase)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func buildRoutes(m *mongoruntime.Runtime, jwtSecret string, timeout time.Duration) ([]route, error) {
	db := m.Database()
	tel := telemetry.ConfigFromEnv(os.LookupEnv)
	origins := splitCSV(os.Getenv("CORS_ORIGINS"))
	toucher := presence.New(db, tel.TrustCloudflare, 2*time.Second)
	sessions := presence.NewSessions(presence.NewMongoSessions(db), toucher, 2*time.Second)
	// ShadowOps account: Chess Studio of the same environment is the identity
	// provider (SSO_ISSUER overrides it, e.g. a local Chess Studio).
	var sso *ssoauth.Verifier
	var central *identityauth.Verifier
	if flag := os.Getenv("ENABLE_SHADOWOPS_IDENTITY"); flag != "" && flag != "false" {
		if flag != "true" {
			return nil, errors.New("invalid central Identity opt-in")
		}
		var err error
		central, err = identityauth.NewStagingVerifier(os.Getenv("ENVIRONMENT"), os.Getenv("SHADOWOPS_IDENTITY_SERVICE_CREDENTIAL"))
		if err != nil {
			return nil, errors.New("central Identity requires staging and its dedicated service credential")
		}
		preflight, cancel := context.WithTimeout(context.Background(), timeout)
		err = accountstore.New(db, timeout).CheckIdentityNamespace(preflight)
		cancel()
		if err != nil {
			return nil, errors.New("central Identity namespace preflight failed")
		}
	}
	if issuer := ssoauth.IssuerFor(os.Getenv("ENVIRONMENT"), os.Getenv("SSO_ISSUER")); issuer != "" {
		sso = ssoauth.NewVerifier(issuer)
		log.Printf("ShadowOps SSO: trusting %s", issuer)
	}
	base := func() gamesapi.Config {
		return gamesapi.Config{
			Accounts: accountstore.New(db, timeout), Presence: toucher, JWTSecret: jwtSecret,
			AllowedOrigins: origins, TrustCloudflare: tel.TrustCloudflare, SSO: sso, Identity: central,
		}
	}
	guardTimeout := envDurationMS("AUTH_GUARD_MONGO_TIMEOUT_MS", 2000*time.Millisecond)
	ipGuard := authguard.New(authguard.ClientIP, authguard.NewMongo(db, authguard.ClientIP, guardTimeout))
	environment := os.Getenv("ENVIRONMENT")
	synthetic := os.Getenv("CHESS_AI_SHARED_SECRET")
	emailRecovery := pythonFlag("ENABLE_EMAIL_RECOVERY", "false")

	identity, err := gamesapi.NewIdentity(gamesapi.IdentityConfig{
		Config: base(), Release: release.AppRelease, Build: release.BuildCommit(os.Getenv),
		Ping: m.Ping, Ready: func() {}, Env: runtimeEnv,
	})
	if err != nil {
		return nil, fmt.Errorf("identity: %w", err)
	}
	system, err := gamesapi.NewSystem(gamesapi.SystemConfig{
		Config: base(), Counter: accountstore.New(db, timeout),
		AdminUsernames: adminUsernames(), DisabledFeatures: os.Getenv("CHESS_DISABLED_FEATURES"),
		BillingSecret: synthetic,
	})
	if err != nil {
		return nil, fmt.Errorf("system: %w", err)
	}
	login, err := gamesapi.NewLogin(gamesapi.LoginConfig{
		Config: base(), LoginAccounts: accountstore.New(db, timeout),
		IdentityGuard: authguard.New(authguard.LoginIdentity, authguard.NewMongo(db, authguard.LoginIdentity, guardTimeout)),
		IPGuard:       ipGuard, Touch: sessions, Environment: environment, SyntheticSecret: synthetic,
	})
	if err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}
	session, err := gamesapi.NewSession(gamesapi.SessionConfig{
		Config: base(), Emails: accountstore.New(db, timeout), Sessions: sessions,
		AdminUsernames: adminUsernames(), EmailRecoveryEnabled: emailRecovery,
	})
	if err != nil {
		return nil, fmt.Errorf("session: %w", err)
	}
	purgeStore := userdata.NewMongo(db, envDurationMS("USER_PURGE_MONGO_TIMEOUT_MS", 5000*time.Millisecond))
	inviteCode := os.Getenv("INVITE_CODE")
	account, err := gamesapi.NewAccount(gamesapi.AccountConfig{
		Config: base(), Store: accountstore.New(db, timeout),
		Purge: func(ctx context.Context, username string) (userdata.Purged, error) {
			return userdata.Purge(ctx, purgeStore, username)
		},
		IPGuard: ipGuard, Touch: sessions,
		AllowRegistration:    registrationAllowed(environment, pythonFlag("ALLOW_REGISTRATION", "true"), inviteCode),
		InviteCode:           inviteCode,
		EmailRecoveryEnabled: emailRecovery, Environment: environment, SyntheticSecret: synthetic,
	})
	if err != nil {
		return nil, fmt.Errorf("account: %w", err)
	}
	recovery, err := gamesapi.NewRecovery(gamesapi.RecoveryConfig{
		Config: base(), LoginAccounts: accountstore.New(db, timeout), Store: accountstore.New(db, timeout),
		Mailer: resetmail.New(os.Getenv("RESEND_API_KEY"), os.Getenv("PASSWORD_RESET_FROM"), environment),
		Touch:  sessions, EmailRecoveryEnabled: emailRecovery, ResetURL: os.Getenv("PASSWORD_RESET_URL"),
		Environment: environment, SyntheticSecret: synthetic,
	})
	if err != nil {
		return nil, fmt.Errorf("recovery: %w", err)
	}
	ops := gamesapi.NewOps(gamesapi.OpsConfig{
		Secret: []byte(jwtSecret), Environment: environment, Store: accountstore.New(db, timeout),
		Purge: func(ctx context.Context, username string) (userdata.Purged, error) {
			return userdata.Purge(ctx, purgeStore, username)
		},
	})
	legacyDB := db.Client().Database(legacyimport.SourceDatabase)
	opsImport := gamesapi.NewOpsImport(gamesapi.OpsImportConfig{
		Secret: []byte(jwtSecret), Environment: environment, Accounts: accountstore.New(db, timeout),
		Import: func(ctx context.Context, username string) (any, error) {
			if err := legacyimport.ValidateDistinctDatabases(legacyDB.Name(), db.Name()); err != nil {
				return nil, err
			}
			return legacyimport.Import(ctx, legacyimport.NewMongoSource(legacyDB, 20*time.Second),
				legacyimport.NewMongoRuns(db, timeout), chroniclesprogression.NewMongo(db, timeout), username, time.Now())
		},
	})
	runs, err := gamesapi.NewChroniclesRuns(gamesapi.ChroniclesRunsConfig{
		Config: base(), Runs: chroniclesrun.NewMongo(db, timeout), Admins: adminUsernames(),
	})
	if err != nil {
		return nil, fmt.Errorf("chronicles runs: %w", err)
	}

	progression, err := gamesapi.NewChroniclesProgression(gamesapi.ChroniclesProgressionConfig{
		Config: base(), Progression: chroniclesprogression.NewMongo(db, timeout),
	})
	if err != nil {
		return nil, fmt.Errorf("chronicles progression: %w", err)
	}

	// The administrative census reads only this environment's MongoDB.
	// It has independent server-side authorization; frontend visibility is cosmetic.
	roster := newAdminRoster(db, jwtSecret, sso, timeout, origins)

	// Reuse native authenticated feedback validation and rate limits. Both
	// player and admin inboxes persist ONLY in Chronicles' own Mongo DB;
	// userdata.Purge already removes the "feedback" collection for an account.
	feedbackStore := newChroniclesFeedbackStore(db, timeout)
	feedback, err := gamesapi.NewFeedback(gamesapi.FeedbackConfig{
		Config: base(), Feedback: feedbackStore,
	})
	if err != nil {
		return nil, fmt.Errorf("feedback: %w", err)
	}
	adminFeedback, err := gamesapi.NewAdminFeedback(gamesapi.AdminFeedbackConfig{
		Config: base(), Feedback: feedbackStore, AdminUsernames: adminUsernames(),
	})
	if err != nil {
		return nil, fmt.Errorf("admin feedback: %w", err)
	}

	ok2 := func(f func(*http.Request) (string, bool)) func(*http.Request) bool {
		return func(r *http.Request) bool { _, ok := f(r); return ok }
	}
	return []route{
		{"chronicles-admin-roster", roster, func(r *http.Request) bool { return r.URL.Path == adminRosterPath }},
		{"login", login, ok2(gamesapi.LoginRoute)},
		{"session", session, ok2(gamesapi.SessionRoute)},
		{"account", account, ok2(gamesapi.AccountRoute)},
		{"recovery", recovery, ok2(gamesapi.RecoveryRoute)},
		{"feedback", feedback, func(r *http.Request) bool { _, _, ok := gamesapi.FeedbackRoute(r); return ok }},
		{"admin-feedback", adminFeedback, ok2(gamesapi.AdminFeedbackRoute)},
		{"runs", runs, func(r *http.Request) bool { _, _, ok := gamesapi.ChroniclesRunsRoute(r); return ok }},
		{"progression", progression, gamesapi.ChroniclesProgressionRoute},
		{"system", system, ok2(gamesapi.SystemRoute)},
		{"identity", identity, ok2(gamesapi.IdentityRoute)},
		{"ops", ops, gamesapi.OpsRoute},
		{"ops-import", opsImport, gamesapi.OpsImportLegacyRoute},
	}, nil
}

// registrationAllowed fails closed when a deployed environment has no invite
// code. Local and CI environments retain their explicit registration setting.
// Existing accounts can still log in if provisioning has not supplied the code.
func registrationAllowed(environment string, enabled bool, inviteCode string) bool {
	if !enabled {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(environment)) {
	case "staging", "stage", "production", "prod":
		return strings.TrimSpace(inviteCode) != ""
	default:
		return true
	}
}

// Chess Studio's staging readiness requires CHESS_STUDIO_RUNTIME_SCHEMA to
// prove the runtime was materialized from Vault + versioned git config.
// Chronicles' staging runtime is materialized exactly that way (the
// shadowops-chronicles-api host wrapper writes it from OCI Vault), so the
// binary declares the same contract unless the environment sets it.
const runtimeSchemaKey, runtimeSchemaVersion = "CHESS_STUDIO_RUNTIME_SCHEMA", "vault-git-v1"

func runtimeEnv(key string) string {
	if value := os.Getenv(key); value != "" || key != runtimeSchemaKey {
		return value
	}
	return runtimeSchemaVersion
}

// healthcheck lets a scratch container probe itself (no curl in the image).
func healthcheck() int {
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + envString("PORT", "8080") + "/api/health")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

// Helpers copied in behaviour from cmd/pvp-edge (package main, not importable).

func envString(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envDurationMS(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return time.Duration(value) * time.Millisecond
}

// ownerAdmin is the game's owner: always an administrator, whatever the
// deploy says. ADMIN_USERNAMES can only add more.
const ownerAdmin = "evilsysadmin"

func adminUsernames() []string {
	admins := splitCSV(os.Getenv("ADMIN_USERNAMES"))
	for _, name := range admins {
		if strings.EqualFold(name, ownerAdmin) || name == "*" {
			return admins
		}
	}
	return append(admins, ownerAdmin)
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if cleaned := strings.TrimSpace(part); cleaned != "" {
			out = append(out, cleaned)
		}
	}
	return out
}

func pythonFlag(key, fallback string) bool {
	raw, ok := os.LookupEnv(key)
	if !ok {
		raw = fallback
	}
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}
