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


## OCI A1 platform gate

OCI Ampere A1 is `linux/arm64`. A GitHub `ubuntu-latest` runner
normally builds `linux/amd64` if the platform is not selected explicitly.
The standalone image now uses `TARGETOS`/`TARGETARCH` to cross-compile
the Go binary and publishes one GHCR **multi-platform manifest digest**
containing both `linux/amd64` and `linux/arm64`.

Before merging, the required container-smoke job uses Buildx/QEMU to build
and actually run the ARM64 container, asserting `/healthz` 200,
`/readyz` 503 without a MongoDB connection, disabled run routes and
UID/GID `65532:65532`. The trusted publisher repeats the ARM64 runtime
smoke before publishing. After the multi-platform push it verifies **both
architectures are present** in the OCI manifest, attests the **manifest
list digest**, and reports that digest for downstream ShadowOps admission.

Do not deploy a single-platform x86 image to OCI A1 or derive deployment
identity from the mutable `staging-<SHA>` tag; use only the attested
multiarch `sha256` digest after the checks have passed. The previously
published pre-multiarch image remains historical test evidence, not the
desired OCI A1 deployment artifact.
