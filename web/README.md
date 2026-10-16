# Independent staging web shell

This is a static, dependency-free **deployment probe**, not a playable build. Serve the `web/` directory from any static HTTP server. No external resources, credentials, cookies, storage or API calls are used.

The actual Chronicles UI currently lives in Chess Studio under `frontend/src/components/ChroniclesOfMatthias.jsx` and depends on multiple game modules/assets. Follow-up PRs must extract the dependency closure and bundle it with Vite before changing this staging shell to a playable entrypoint.

Do not route production traffic or promise save compatibility based on this page alone.


## OCI/Cloudflare staging image

The independent GHCR web image is built from this directory and contains
only the static staging shell. On a trusted main-branch push affecting the
web assets or publish workflow, GitHub Actions checks the shell, builds and
runs the ARM64 container under QEMU, pushes one `linux/amd64` +
`linux/arm64` OCI manifest and signs its immutable digest.

Image: `ghcr.io/evilsysadmin/chronicles-web`. Downstream OCI deployment
must use the reported `sha256` **manifest digest**, never the mutable
`staging-<SHA>` tag. Cloudflare/DNS changes must be reviewed separately.
The web container makes no backend calls, creates no accounts and does not
touch existing Chess Studio saves. An image pushed successfully is **not**
evidence of a deployed or playable site.
