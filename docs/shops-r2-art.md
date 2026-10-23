# Odo premium · GitHub Actions → Cloudflare R2 → Chronicles

The **approved** `odo-premium-composite.webp` is 1748×899, exactly **200250 bytes**, SHA-256
`79e0b13fc2ee2ffbc8f8aa7a1f569cb4c5776935fcb428bafc09a6820aea43e1`.
No image generation or baked purchase UI. Keep the original WebP out of Git history.

## Ownership and automatic pipeline

We use the already-operational `chess-studio-assets` Cloudflare R2 bucket and CDN
`https://assets.chess-studio.shadowops.dpdns.org`. Chess Studio owns the
[Odo publication workflow](https://github.com/evilsysadmin/chess-studio/blob/main/.github/workflows/chronicles-odo-r2-publish.yml)
(merged in PR #6118) and its secrets; `chronicles/shops/` is protected by
the existing R2 retention policy (Chess Studio PR #6111).

**One-time source-asset handoff:** create a draft GitHub Release in **Chess Studio**
tagged `chronicles-odo-r2-79e0b13fc2ee2ffb`, attach the exact approved
`odo-premium-composite.webp` file, and then **Publish release**. The pipeline
also offers `workflow_dispatch` for reruns using that fixed release tag.
There is no manual R2 upload and no local publisher command.

GitHub Actions then, without further intervention:

1. Rejects any other release tag or asset bytes. Rechecks SHA-256, byte length and
   WebP header before using Cloudflare credentials.
2. Downloads a fresh Chronicles `main` checkout, uses the **existing Chess Studio**
   raw-PUT R2 publisher with a custom Chronicles manifest and immutable SHA16 key:
   `chronicles/shops/odo/odo-premium-composite-79e0b13fc2ee2ffb.webp`.
3. Downloads the **public HTTPS** object and validates content-type, exact
   size, no redirect and full SHA-256, with bounded propagation retries.
4. Checks that the R2 manifest still contains every unrelated entry unchanged
   (including Chronicles music), and opens a narrowly scoped
   **manifest-only PR** in `evilsysadmin/chronicles-of-matthias`.
5. Leaves that PR open for Chronicles CI and real mobile/desktop visual
   acceptance. No automatic art promotion into production.

The cross-repository PR step uses the Chess Studio secret
`CHRONICLES_MANIFEST_PR_TOKEN`, or the existing `CI_PR_BOT_PAT` **only if**
its permissions already cover Chronicles Contents + Pull requests write.
Missing/insufficient permissions must **fail closed**, not impersonate a
successful deployment or leak secrets to the frontend.

## Runtime safety and release

`chroniclesShopArtUrl('chronicles.shop.odo')` uses only a verified, immutable
pin from `frontend/src/assets/r2-assets-manifest.json`. Until the PR is
merged/deployed, **Odo stays on his local SVG**. On a failed CDN image load,
the UI automatically falls back to that same SVG. Brunna, guild and all
existing music/GLBs are unchanged.

Final acceptance requires real screenshots of Odo in desktop and mobile,
Chronicles CI, and staging's actual deployed source SHA. An uploaded release
asset, green publishing workflow or proposed manifest PR is **not** proof that
Odo is live.

Tracked in Chronicles #166 and shadowops-infra #249.
