import manifest from './assets/r2-assets-manifest.json';

export const R2_ASSET_BASE_URL = manifest.baseUrl;

export function r2AssetEntry(logicalId) {
  if (typeof logicalId !== 'string' || !logicalId) return null;
  const entry = manifest.assets?.[logicalId];
  return entry && typeof entry === 'object' ? entry : null;
}

export function r2AssetUrl(logicalId, fallbackUrl = '') {
  const entry = r2AssetEntry(logicalId);
  if (!entry || typeof entry.url !== 'string') return fallbackUrl;
  try {
    // A domain cutover is a single manifest edit, never an independent URL
    // per asset. Reject mixed origins, wrong object keys and URL parameters.
    const base = new URL(R2_ASSET_BASE_URL);
    const segments = typeof entry.key === 'string' ? entry.key.split('/') : [];
    if (base.protocol !== 'https:' || base.pathname !== '/'
      || base.username || base.password || base.search || base.hash
      || segments.length < 2 || segments[0] !== 'chronicles'
      || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      return fallbackUrl;
    }
    const expected = new URL(`/${segments.map(encodeURIComponent).join('/')}`, base);
    const actual = new URL(entry.url);
    if (actual.href !== expected.href) return fallbackUrl;
    return actual.href;
  } catch {
    return fallbackUrl;
  }
}
