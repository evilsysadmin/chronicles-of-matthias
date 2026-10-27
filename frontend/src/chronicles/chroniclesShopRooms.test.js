import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesShopRoom } from './chroniclesShopRooms.js';
import { CHRONICLES_SHOP_ART_ORIGIN, chroniclesShopArtUrl } from './chroniclesShopArt.js';

describe('Chronicles shop rooms', () => {
  it('shows each Swordhaven shopkeeper in their own room', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const room = (id) => chroniclesShopRoom(town.interactables.find((entry) => entry.id === id))?.id;
    expect(room('first-book-armorer')).toBe('odo-forge');
    const odo = chroniclesShopRoom(town.interactables.find((entry) => entry.id === 'first-book-armorer'));
    if (chroniclesShopArtUrl('chronicles.shop.odo')) {
      expect(odo.src).toBe(chroniclesShopArtUrl('chronicles.shop.odo'));
      expect(odo.fallbackSrc).toContain('odo-armory.svg');
    } else {
      expect(odo.src).toContain('odo-armory.svg');
      expect(odo.fallbackSrc).toBeNull();
    }
    expect(room('first-book-weaponsmith')).toBe('brunna-armory');
    const brunna = chroniclesShopRoom(town.interactables.find((entry) => entry.id === 'first-book-weaponsmith'));
    expect(brunna.src).toContain('brunna-forge.webp');
    expect(room('first-book-guild')).toBe('guild-sanctum');
    expect(chroniclesShopRoom(town.interactables.find((entry) => entry.id === 'first-book-guild')).src).toContain('guild-archive.svg');
  });

  it('has no room for counters without a building', () => {
    expect(chroniclesShopRoom({ id: 'stall' })).toBeNull();
    expect(chroniclesShopRoom(null)).toBeNull();
  });
});

describe('Chronicles shop art manifests — exact R2 pins only', () => {
  const digest = '79e0b13fc2ee2ffbc8f8aa7a1f569cb4c5776935fcb428bafc09a6820aea43e1';
  const key = `chronicles/shops/odo/odo-premium-composite-${digest.slice(0, 16)}.webp`;
  const url = `${CHRONICLES_SHOP_ART_ORIGIN}/${key}`;
  const source = {
    version: 1, baseUrl: CHRONICLES_SHOP_ART_ORIGIN,
    assets: { 'chronicles.shop.odo': {
      sha256: digest, key, url, bytes: 200250, contentType: 'image/webp',
    } },
  };
  it('accepts approved immutable SHA16 address only after publisher records the entry', () => {
    expect(chroniclesShopArtUrl('chronicles.shop.odo', source)).toBe(url);
    // Today the manifest is unpinned. When the approved R2 entry is promoted,
    // this acceptance test must require EXACTLY its reviewed digest/URL, not
    // reject a correct manifest-only PR merely because Odo is finally live.
    const liveUrl = chroniclesShopArtUrl('chronicles.shop.odo');
    expect(liveUrl === null || liveUrl === url).toBe(true);
  });
  it('rejects other domain, unsafe/other-family key, stale digest, HTTP and type mismatch', () => {
    const mutate = (field, value) => ({
      ...source, assets: {
        'chronicles.shop.odo': { ...source.assets['chronicles.shop.odo'], [field]: value },
      },
    });
    expect(chroniclesShopArtUrl('chronicles.shop.odo', { ...source, baseUrl:'https://evil.invalid' })).toBeNull();
    for (const [field, value] of [
      ['key', '../odo.webp'], ['key', 'pawn-slug/odo-'+digest.slice(0, 16)+'.webp'],
      ['sha256', '0'.repeat(64)], ['url', url.replace('https:', 'http:')],
      ['url', url+'?v=1'], ['url', 'https://evil.invalid/odo.webp'],
      ['contentType', 'text/html'], ['bytes', 0],
    ]) expect(chroniclesShopArtUrl('chronicles.shop.odo', mutate(field,value))).toBeNull();
  });
  it('keeps Brunna and guild local while Odo has offline fallback', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const odo = chroniclesShopRoom(town.interactables.find(e => e.id === 'first-book-armorer'));
    if (chroniclesShopArtUrl('chronicles.shop.odo')) {
      expect(odo.src).toBe(url);
      expect(odo.fallbackSrc).toContain('odo-armory.svg');
    } else {
      expect(odo.src).toContain('odo-armory.svg');
      expect(odo.fallbackSrc).toBeNull();
    }
    expect(chroniclesShopRoom(town.interactables.find(e => e.id === 'first-book-weaponsmith')).src)
      .toContain('brunna-forge.webp');
  });
});
