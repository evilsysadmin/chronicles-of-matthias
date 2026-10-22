import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHRONICLES_SHOP_ITEM_ART } from './chroniclesShopItemArt.js';

// Merchandise art is a source asset, never a screenshot of shop UI, hotlinked
// content or low-resolution icon stretched to fill the large detail portrait.
const portraits = Object.freeze({
  'wooden-longbow': 'wooden-longbow.svg',
  'brass-crossbow': 'brass-crossbow.svg',
  'brass-dagger': 'brass-dagger.svg',
  'bronze-sword': 'bronze-sword.svg',
  'wooden-shield': 'wooden-shield.svg',
  'leather-leather': 'leather-cuirass.svg',
});

describe('Authored 2D merchant portraits', () => {
  it('only maps approved canonical IDs to dedicated non-empty sprites', () => {
    expect(Object.keys(CHRONICLES_SHOP_ITEM_ART).sort()).toEqual(Object.keys(portraits).sort());
    for (const id of Object.keys(portraits)) {
      expect(CHRONICLES_SHOP_ITEM_ART[id]).toBeTruthy();
    }
  });

  for (const [itemId, assetName] of Object.entries(portraits)) {
    it(itemId + ' keeps an optimized, self-contained 512px illustration', () => {
      const raw = readFileSync(new URL('../assets/chronicles/ui/items/' + assetName, import.meta.url), 'utf8');
      expect(raw.length).toBeGreaterThan(2000);
      expect(raw.length).toBeLessThan(50000);
      expect(raw).toMatch(/^<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(raw).toContain('viewBox="0 0 512 512"');
      expect(raw).toContain('width="512"');
      expect(raw).toContain('height="512"');
      expect((raw.match(/<path\b/g) || []).length).toBeGreaterThan(7);
      expect(raw).not.toMatch(/<(?:script|foreignObject|image|text|a)\b/i);
      expect(raw).not.toMatch(/\b(?:href|onload|onclick)\s*=/i);
      expect(raw).not.toMatch(/data:image|url\(\s*["']?https?:/i);

      const definitions = [...raw.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(definitions).size).toBe(definitions.length);
      for (const match of raw.matchAll(/url\(#([^)]*)\)/g)) {
        expect(definitions).toContain(match[1]);
      }
    });
  }
});
