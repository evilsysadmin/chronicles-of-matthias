# Independent ShadowOps Identity: staging opt-in

The new consumer is implemented independently in `api/internal/identityauth`.
It does not import the Identity runtime or share Chess/Identity signing secrets.
The existing Chess SSO and local login remain the default. No staging endpoint,
secret or deployment is provisioned by this source PR.

Backend opt-in requires **both**:

```
ENVIRONMENT=staging
ENABLE_SHADOWOPS_IDENTITY=true
SHADOWOPS_IDENTITY_SERVICE_CREDENTIAL=<independent soc1_ Chronicles server credential>
```

The credential comes from the trusted Infra owner, shared only with the
Identity authority's fixed Chronicles consumer configuration. Never put it in
Vite configuration, browser storage, URLs, repository files or logs. Startup
rejects an enabled configuration outside staging or with malformed credentials.
The issuer is pinned to `https://id-staging.shadowops.dpdns.org`, audience
`chronicles`; production and arbitrary endpoint overrides are not supported.

Each protected request verifies actual Ed25519 signature, key/algorithm/type,
canonical UUIDv4/JTI, positive session version, not-before, issued/expiry times
and maximum 120-second lifetime. It then calls the authenticated HTTPS
freshness RPC from Infra (implemented in shadowops-infra PR #323), with no
cookie, Origin or redirect following. Evidence must match every claim and be
at most two seconds old, with all state flags active. Public keys are cached;
freshness evidence is never cached. Missing/revoked evidence denies access;
service unavailability returns 503 without accepting the token.

The game initializes one idempotent passwordless profile using
`shadowops:staging:<verified UUID>`, with immutable `sso_issuer` and `sso_subject`.
That internal namespace is reserved: local registration, local HMAC JWTs and
legacy SSO cannot claim it. A pre-existing record without the exact binding is
a conflict, not an account link. Existing username-based games/progress remain
separate, and central login never grants admin permissions. Before rollout,
Infra must verify no legacy accounts occupy the newly reserved namespace;
any such account requires an explicit ownership-preserving migration. Enabling
the backend now runs that read-only preflight against the actual game database
before wiring routes. It rejects case-insensitive reserved names, malformed or
cross-environment bindings and local password credentials in that namespace.
Correctly bound passwordless profiles pass on subsequent restarts. An unavailable
database also stops activation; the preflight never renames, links or deletes rows.

Frontend opt-in is a staging-only build setting:

```
VITE_SHADOWOPS_IDENTITY=central-staging
```

At the exact staging game origin, the existing login offers a central entry
link. The central page returns to `/?shadowops=central`; Chronicles exchanges
the host-only cookie for its own token. Passwords/signup/recovery stay on the
central page, with an explicit return to the previous login. A stored central
token retains its provider context across reloads. Frontend claim parsing only
selects transport/profile storage: API checks above always authorize requests.
Late refresh/restore cannot resurrect a session after logout or another login.

Release order belongs to `evilsysadmin/shadowops-infra`: provision and verify
the separate Identity service/credentials, release the backend opt-in, prove
real login/save/logout/revocation and legacy compatibility, then release the
frontend opt-in. Roll back by returning the UI to its old entry and disabling
the backend flag, preserving data and keeping the reserved namespace protected.
Production rollout and linking existing legacy accounts are separate changes.

Tests cover real signatures and TLS RPCs, wrong realm/audience/times,
forgery, stale/mismatched evidence, outages and no freshness caching; API
entry/profile isolation and revoked sessions; real ephemeral Mongo profile
collision/concurrent initialization; frontend provider gating and logout races.
Local Chromium desktop/mobile captures exercise the actual new login UI with
anonymous API fixtures, not a fabricated signed-in game. Actual public staging
end-to-end login is still a release acceptance requirement.
