import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesInventoryItemIcon, { chroniclesItemIconKind } from './ChroniclesInventoryItemIcon.jsx';
import { chroniclesInventoryMiniatureSpec } from './ChroniclesInventoryMiniature.jsx';

const markup = (id) => renderToStaticMarkup(
  createElement(ChroniclesInventoryItemIcon, { item: { id } }),
);

describe('MM3 material-aware inventory miniatures', () => {
  it('preserves authored exact-ID art rather than replacing it with generic artwork', () => {
    const exactIds = [
      ['bronze-sword', 'sword'],
      ['brass-dagger', 'dagger'],
      ['wooden-longbow', 'bow'],
      ['brass-crossbow', 'crossbow'],
      ['leather-leather', 'armor'],
      ['brass-shield', 'shield'],
      ['healing-potion', 'other'],
    ];
    for (const [id, kind] of exactIds) {
      const html = markup(id);
      expect(chroniclesItemIconKind({ id })).toBe(kind);
      expect(html).toContain('class="chronicles-character-sheet__illustrated-item-icon"');
      expect(html).toContain('<img');
      expect(html).toContain('alt=""');
      expect(html).toContain('loading="lazy"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain(`data-item-icon="${kind}"`);
    }
  });

  const uncoveredCatalog = [
    ['bronze-dagger', 'dagger', 'dagger', 'bronze'],
    ['bronze-mace', 'mace', 'mace', 'bronze'],
    ['wooden-bow', 'bow', 'bow', 'wooden'],
    ['bronze-longbow', 'bow', 'longbow', 'bronze'],
    ['steel-crossbow', 'crossbow', 'crossbow', 'steel'],
    ['brass-sling', 'sling', 'sling', 'brass'],
    ['ivory-staff', 'staff', 'staff', 'ivory'],
    ['wooden-spear', 'spear', 'spear', 'wooden'],
    ['steel-axe', 'axe', 'axe', 'steel'],
    ['iron-sword', 'sword', 'sword', 'iron'],
    ['bronze-shield', 'shield', 'shield', 'bronze'],
    ['leather-padded', 'armor', 'padded', 'leather'],
    ['steel-leather', 'armor', 'leather', 'steel'],
    ['brass-scale', 'armor', 'scale', 'brass'],
    ['iron-ring', 'armor', 'ring', 'iron'],
    ['steel-chain', 'armor', 'chain', 'steel'],
    ['iron-splint', 'armor', 'splint', 'iron'],
    ['silver-plate', 'armor', 'plate', 'silver'],
  ];

  it.each(uncoveredCatalog)('illustrates %s as %s (%s, %s)', (id, iconKind, family, material) => {
    expect(chroniclesInventoryMiniatureSpec({ id })).toEqual({ family, material });
    expect(chroniclesItemIconKind({ id })).toBe(iconKind);
    const html = markup(id);
    expect(html).toContain('chronicles-character-sheet__inventory-miniature');
    expect(html).toContain('viewBox="0 0 48 48"');
    expect(html).toContain(`data-item-icon="${iconKind}"`);
    expect(html).toContain(`data-illustration-family="${family}"`);
    expect(html).toContain(`data-illustration-material="${material}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('shape-rendering="crispEdges"');
    expect(html).toContain('<linearGradient');
    expect(html).toContain('<path');
  });

  it('assigns unique gradient IDs when two miniatures share one sheet', () => {
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(ChroniclesInventoryItemIcon, { item: { id: 'bronze-mace' } }),
      createElement(ChroniclesInventoryItemIcon, { item: { id: 'steel-mace' } }),
    ));
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never paints an unknown item as a known weapon or armor', () => {
    expect(chroniclesInventoryMiniatureSpec({ id: 'unknown-relic' })).toBeNull();
    expect(chroniclesItemIconKind({ id: 'unknown-relic' })).toBe('other');
    const html = markup('unknown-relic');
    expect(html).toContain('viewBox="0 0 16 16"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).not.toContain('inventory-miniature');
    expect(html).not.toContain('<img');
  });
});
