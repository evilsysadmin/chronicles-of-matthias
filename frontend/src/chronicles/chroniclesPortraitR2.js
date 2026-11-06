import manifest from './chroniclesPortraitR2Manifest.json';

// Only explicitly approved, immutable WebP objects on the existing Chronicles
// R2 custom domain may replace a bundled portrait. Empty by default until
// publication is independently verified; local art remains authoritative.
export const CHRONICLES_PORTRAIT_R2_HOST = 'assets.chronicles.shadowops.dpdns.org';
const VALID_ID = /^(?:matthias|rook|bishop|knight|(?:male|female)-(?:0[1-9]|10))$/;
const VERSION = /^[a-f0-9]{16}$/;

export function chroniclesPortraitR2Url(id, variant = 'awake', entries = manifest.portraits) {
  if (!VALID_ID.test(String(id || '')) || !['awake', 'sleep'].includes(variant)
    || !entries || typeof entries !== 'object' || Array.isArray(entries)) return null;
  const value = entries[id]?.[variant];
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    const prefix = `/portraits/${id}/${variant}-`;
    if (parsed.protocol !== 'https:' || parsed.hostname !== CHRONICLES_PORTRAIT_R2_HOST
      || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash
      || !parsed.pathname.startsWith(prefix) || !parsed.pathname.endsWith('.webp')
      || !VERSION.test(parsed.pathname.slice(prefix.length, -5))
      || parsed.href !== value) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
