# Chronicles Admin: trusted ShadowOps Identity aliases (staging only)

Chronicles' administrative roster normally displays an abbreviated technical
subject for central Identity accounts. The optional alias enrichment requires
both a trusted backend-only Identity RPC and explicit **per-product admin
authorization**. It is not an account merge or an authentication mechanism.

## Opt-in configuration

By default, `SHADOWOPS_IDENTITY_ADMIN_ALIAS_CREDENTIAL` is absent, so the
Chronicles API does not contact the alias service and the roster remains
unchanged. An operator may provision a separately generated 256-bit `soa1_`
credential to the protected Chronicles API staging secret bundle **only** once
the matching secret is configured on staging Identity
(`chronicles_admin_alias_credential`). This is never a
`VITE_*` browser variable and must never be committed, logged or reused as
`SHADOWOPS_IDENTITY_SERVICE_CREDENTIAL` (`soc1_` freshness credential).
Never enable it in production, local environments or with central Identity off.

With the opt-in present, API startup rejects invalid credentials or a
non-staging environment. `GET /api/chronicles/admin/users` first validates
the invoking administrator's authenticated session and explicit product-scoped
admin grant. Only after reading a valid local page of up to 40 users does
Chronicles send the requested canonical staging UUIDv4 subjects to the pinned
HTTPS `POST /api/identity/admin-aliases` backend-only endpoint. No client
token, cookies, hero names or game progress is sent.

The response supplies a bounded, verified native `accountAlias` field for
matching central users only. Technical `username` remains the primary key
and stays in each detail view. Hero/character names are unrelated. The UI
prefers the account alias only for canonical central Identity subjects and
searches both alias and technical ID.

If Identity is unreachable, returns 401/429/503, lacks an active native
account or returns unexpected or malformed JSON, the existing roster still
works and uses abbreviated technical IDs. No alias result is cached or
persisted. Account/save ownership and grants never depend on a display alias.

## Release verification

Deploy and rotate credentials exclusively from the Infra-owned staging
release workflow and private secret managers. Verify the exact Chronicles API
SHA, the Identity service version and a real authorized-admin roster request.
Test another normal user's 403, Identity outage fallback, alias removal
on suspension, legacy-user fallback and zero cross-environment lookups.
Leave `SHADOWOPS_IDENTITY_ADMIN_ALIAS_CREDENTIAL` unset until that end-to-end
validation is ready. This source change alone **does not** deploy or activate
the service.

Related: shadowops-infra issue #374 and PR #383.
