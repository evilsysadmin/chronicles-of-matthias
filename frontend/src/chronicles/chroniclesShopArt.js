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
