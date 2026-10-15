# Staging-only GHCR API images

The `Publish SHA-pinned Chronicles staging API image` GitHub workflow builds
and publishes the standalone Go API image to
`ghcr.io/evilsysadmin/chronicles-api` **only for a successful push job on
`main`**. Pull requests run its publication-policy tests but do not receive
registry write permissions.

Before registry publication, the same privileged job verifies the repository
tests, the pinned Go dependency graph, MongoDB integration tests, a Go build,
a container build and a live default-container smoke. The image is tagged
`staging-<full-git-sha>`, labeled with its source SHA, pushed to GHCR and
attested with a GitHub provenance attestation. Deployments must consume its
**content digest**, not its mutable tag.

The published package contains a read-only, staging-gated subset of the
Chronicles API; it does **not** imply a complete playable game backend.
Publishing does not update OCI, DNS, Cloudflare, Render, Chess Studio,
MongoDB state or a production release.

## Promotion boundary

1. Capture the pushed image's SHA and `sha256` digest from the successful
   workflow summary.
2. Verify its provenance and source SHA using the admission procedures in
   `evilsysadmin/shadowops-infra`, before setting `CHRONICLES_IMAGE_DIGEST`.
3. Only OCI staging uses `compose.yaml` together with
   `compose.staging.yaml`; run the synthetic authenticated read smoke.
4. Do not promote production until auth, browser integration, full gameplay
   route parity, saved-game migration and restore/rollback have been tested.

The workflow publishes an image artifact, **not a staging deployment**.
GHCR permissions or package settings may still need attention if publishing
fails; never treat a push or an attestation as successful without its actual
workflow result.
