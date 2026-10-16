# Independent Chronicles staging web shell

This is a static, dependency-free **deployment probe**, not a playable
Chronicles build. Its assets live in the game repository; its public
deployment and DNS/TLS lifecycle are owned by **ShadowOps Infra**.

The first live Pages target is
`https://staging.chronicles.shadowops.dpdns.org`, under the separately
managed Cloudflare Pages project `chronicles-staging`.

## Owner handoff (October 2026)

The former `.github/workflows/pages-staging.yml`, source-side Pages
reconciler and source-side deployment tests were intentionally retired.
**Do not reintroduce Cloudflare credentials, a Pages publisher or DNS
reconciliation into this application repository.**

For approved staging releases, use
[ShadowOps Infra's Chronicles Pages release workflow](https://github.com/evilsysadmin/shadowops-infra/actions/workflows/chronicles-pages-release.yml).
That workflow reads the exact source SHA from protected Chronicles `main`,
runs the web-shell tests, checks both protected mains, ensures this legacy
publisher is absent, then publishes and validates the dedicated hostname.
ShadowOps must hold the Cloudflare secrets; this repository does not need
them. A successful CI merge here is **not** proof that the site is live.

The actual playable UI still lives in Chess Studio under
`frontend/src/components/ChroniclesOfMatthias.jsx` with additional
modules/assets. Future game changes should extract and package that runtime
in this repo, leaving all infrastructure ownership in ShadowOps.

## OCI/GHCR distribution (independent of Pages)

The independent `ghcr.io/evilsysadmin/chronicles-web` ARM64+AMD64
container remains available as a staging-only static probe. The image
publisher is an **artifact build**, not a live deployment. It reports
an immutable signed OCI manifest digest to be consumed by a verified
ShadowOps release path. No API, saved game, accounts or production
resources are modified by this static page.
