# Standalone frontend delivery

Two independent Cloudflare Pages **Direct Upload** projects are reserved by naming convention:

- Staging project `chronicles-staging` → `staging.chronicles.shadowops.dpdns.org`
- Production project `chronicles-production` → `chronicles.shadowops.dpdns.org`

These are **proposed names**, not evidence of provisioned resources. CI may build and validate `dist/` without secrets; actual upload requires a separately authorized workflow and scoped Cloudflare credentials.

Promotion sequence: tested source SHA → Pages project upload → pages.dev health/build verification → custom-domain DNS/TLS activation → public-origin smoke → release marker. Never point public DNS to an unverified deployment. Keep production promotion independent of staging and Chess Studio. Preserve previous release for rollback.

Cloudflare Pages is frontend only. API/backend, authentication, cross-origin saves and data migrations must be validated separately before public cutover.
