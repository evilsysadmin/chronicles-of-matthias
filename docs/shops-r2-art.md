# Chronicles merchant assets on existing Chess Studio R2

Source of truth: approved local art **odo-premium-composite.webp**, 1748×899,
200250 bytes, SHA-256 `79e0b13fc2ee2ffbc8f8aa7a1f569cb4c5776935fcb428bafc09a6820aea43e1`.
The asset is NOT added to Git. Never replace it with an AI mock, nor bake
the shop's functional buy/sell UI into the art.

The CDN is shared with Chess Studio/Pawn Slug and Star Adventures:
`https://assets.chess-studio.shadowops.dpdns.org` (bucket: `chess-studio-assets`).
Chess Studio R2 GC protects `chronicles/shops/` (PR #6111).

## Phase A — publish after validating the approved file

From a Chess Studio checkout with its existing authorized Cloudflare secrets:

```bash
sha256sum /path/to/odo-premium-composite.webp
# Must match the full SHA above.
python3 -S scripts/r2_asset_publish.py publish /path/to/odo-premium-composite.webp \
  --logical-id chronicles.shop.odo --prefix chronicles/shops/odo \
  --manifest /path/to/chronicles-of-matthias/frontend/src/assets/r2-assets-manifest.json \
  --dry-run
python3 -S scripts/r2_asset_publish.py publish /path/to/odo-premium-composite.webp \
  --logical-id chronicles.shop.odo --prefix chronicles/shops/odo \
  --manifest /path/to/chronicles-of-matthias/frontend/src/assets/r2-assets-manifest.json
```

**Required live gate:** fetch public HTTPS bytes at the emitted immutable URL;
confirm HTTP 200, `Content-Type: image/webp`, 200250 bytes, and SHA-256
matching the approved original. A successful publisher printout alone does
not prove public CDN correctness. Do not merge a manifest pointing to a
missing or corrupted object.

## Phase B — activate by Git manifest commit

Publisher adds the verified entry to this repository's
`frontend/src/assets/r2-assets-manifest.json`. Commit ONLY the small JSON
change. `chroniclesShopArtUrl('chronicles.shop.odo')` refuses unrecorded,
mutable, non-HTTPS, different-family and mismatched SHA references. Runtime
automatically uses verified entry once merged/deployed. Odo's old SVG remains
as browser load-failure fallback, while Brunna and guild are unchanged.

Verify game snapshots of Odo at desktop and mobile, and staging's exact
release SHA, before calling the release complete. Related issues:
Chronicles #166 and shadowops-infra #249.
