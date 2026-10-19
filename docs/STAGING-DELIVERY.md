# Chronicles staging: CI to CD

**Code/CI owner:** `evilsysadmin/chronicles-of-matthias`. **Deployment owner:** `evilsysadmin/shadowops-infra`.

A merge to protected Chronicles `main` runs repository checks, frontend Vitest/browser smoke, and API E2E + signed GHCR image publish. Infra independently demands all three successful runs for the **exact same SHA** before publishing that SHA to Cloudflare Pages or OCI staging.

Infra has its own hourly checks (API minute 17, Pages minute 47 UTC), which require **no cross-repository secret**. On a successful deployment Infra records a per-SHA verified artifact. Failed/pending code never deploys; production always requires a separate manual promotion.

## Optional instant dispatch (faster than hourly polling)

To receive staging requests as soon as **all three** Chronicle checks finish, add this Actions secret in the **Chronicles repo**:

`SHADOWOPS_INFRA_ACTIONS_TOKEN`

Its value should be a **fine-grained GitHub PAT**, restricted to `evilsysadmin/shadowops-infra`, with **Actions: Read and write** and Metadata: Read. No Cloudflare or OCI permissions are needed. Do not put its value in source, logs or issue comments.

The source workflow `signal-shadowops-infra.yml` is triggered by a completed source check; it verifies the other two and dispatches only the two dedicated staging workflows on **Infra main**, passing the exact source SHA and `only_if_new=true`. Infra re-verifies the SHA, all checks, image attestation and its verified receipts before changing anything. Duplicate/stale signals are safe; hourly polling remains the fail-safe.

Without the token the source workflow exits successfully with an informational notice, and staging continues to update via the hourly Infra schedules. If the token expires, the source signal fails but hourly polling remains available.
