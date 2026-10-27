import manifest from '../assets/r2-assets-manifest.json';

// Shared Cloudflare bucket is owned by Chess Studio. This independent app
// only consumes exact published entries; it must not guess future object URLs.
// Publisher contract: python3 -S scripts/r2_asset_publish.py publish <file>
//   --logical-id chronicles.shop.odo --prefix chronicles/shops/odo
//   --manifest <chronicles>/frontend/src/assets/r2-assets-manifest.json
export const CHRONICLES_SHOP_ART_ORIGIN = 'https://assets.chess-studio.shadowops.dpdns.org';

export function chroniclesShopArtUrl(logicalId, source = manifest) {
  const entry = source?.assets?.[logicalId];
  if (typeof logicalId !== 'string' || !logicalId.startsWith('chronicles.shop.')
    || !entry || typeof entry !== 'object') return null;
  if (source?.version !== 1 || source.baseUrl !== CHRONICLES_SHOP_ART_ORIGIN
    || entry.contentType !== 'image/webp' || !Number.isSafeInteger(entry.bytes)
    || entry.bytes <= 0 || !/^[0-9a-f]{64}$/.test(entry.sha256 || '')) return null;
  // Match Chess Studio's established immutable SHA16 suffix, never mutable
  // aliases or URL keys outside the merchant namespace.
  if (typeof entry.key !== 'string'
    || !/^chronicles\/shops\/[a-z0-9-]+\/[a-z0-9._-]+-[0-9a-f]{16}\.webp$/.test(entry.key)
    || !entry.key.endsWith(`-${entry.sha256.slice(0, 16)}.webp`)) return null;
  const expected = `${CHRONICLES_SHOP_ART_ORIGIN}/${entry.key}`;
  return entry.url === expected ? expected : null;
}


// This clean WebP is uploaded to the *independent* Chronicles R2 bucket,
// not to Chess Studio's content-addressed shop-publisher namespace.
// The Cloudflare dashboard path is private; only this separate, public
// custom-domain URL may be used by the browser. Keep the local room as a
// fail-safe until the public HTTPS GET is verified in staging.
// This object key is mutable: do not declare a year-long immutable cache TTL.
export const CHRONICLES_ODO_UPLOADED_ART_KEY = 'stores/Odo_Armeria_Premium_Fondo_Limpio_2026.webp';
export const CHRONICLES_ODO_UPLOADED_ART_URL =
  `https://assets.chronicles.shadowops.dpdns.org/${CHRONICLES_ODO_UPLOADED_ART_KEY}`;

// Approved clean 1672×941 Swordhaven apothecary illustration, uploaded by
// the player to the independent Chronicles bucket. This is a mutable key,
// not an immutable SHA-named Chess Studio asset; never request long-lived
// immutable cache headers. The bundled SVG remains a fail-safe.
export const CHRONICLES_BOTICA_PREMIUM_ART_KEY = 'stores/botica-premium.webp';
export const CHRONICLES_BOTICA_PREMIUM_ART_URL =
  `https://assets.chronicles.shadowops.dpdns.org/${CHRONICLES_BOTICA_PREMIUM_ART_KEY}`;

// Player-uploaded clean 1672×941 art in the independent Chronicles R2 bucket.
// Mutable object key: never advertise immutable caching. Guild keeps its
// bundled illustrated SVG for offline/CDN-failure fallback.
export const CHRONICLES_GUILD_PREMIUM_ART_KEY = 'stores/gremio-premium.webp';
export const CHRONICLES_GUILD_PREMIUM_ART_URL =
  `https://assets.chronicles.shadowops.dpdns.org/${CHRONICLES_GUILD_PREMIUM_ART_KEY}`;
