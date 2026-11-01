import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesInventoryItemIcon, { chroniclesItemIconKind } from './ChroniclesInventoryItemIcon.jsx';

describe('MM3 illustrated items and pixel fallbacks', () => {
  it('distinguishes actual catalog families and armor, not generic equipped badges', () => {
    const names = [
      ['bronze-sword', 'sword'],
      ['brass-dagger', 'dagger'],
      ['wooden-bow', 'bow'],
      ['wooden-longbow', 'bow'],
      ['brass-crossbow', 'crossbow'],
      ['brass-sling', 'sling'],
      ['leather-leather', 'armor'],
      ['brass-shield', 'shield'],
    ];
    for (const [id, kind] of names) {
      expect(chroniclesItemIconKind({ id })).toBe(kind);
      const html = renderToStaticMarkup(createElement(ChroniclesInventoryItemIcon, { item: { id } }));
      expect(html).toContain(`data-item-icon="${kind}"`);
      expect(html).toContain('aria-hidden="true"');
      if (['bronze-sword', 'brass-dagger', 'wooden-longbow', 'brass-crossbow', 'leather-leather', 'brass-shield'].includes(id)) {
        expect(html).toContain('class="chronicles-character-sheet__illustrated-item-icon"');
        expect(html).toContain('<img');
        expect(html).toContain('alt=""');
        expect(html).toContain('loading="lazy"');
        expect(html).not.toContain('shape-rendering="crispEdges"');
      } else {
        expect(html).toContain('viewBox="0 0 16 16"');
        expect(html).toContain('shape-rendering="crispEdges"');
      }
    }
  });

  it('retains a crisp pixel icon for items without authored illustrations', () => {
    for (const id of ['brass-sling', 'unknown-relic']) {
      const html = renderToStaticMarkup(createElement(ChroniclesInventoryItemIcon, { item: { id } }));
      expect(html).toContain('<svg');
      expect(html).toContain('shape-rendering="crispEdges"');
      expect(html).not.toContain('<img');
    }
  });

  it('keeps unknown loot visible with a safe fallback silhouette', () => {
    expect(chroniclesItemIconKind({ id: 'unknown-relic' })).toBe('other');
  });
});
