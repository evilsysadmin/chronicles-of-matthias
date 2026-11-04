import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHRONICLES_SPELLS } from '../chronicles/chroniclesMagic.js';
import ChroniclesSpellIcon, { CHRONICLES_SPELL_ICON_IDS } from './ChroniclesSpellIcon.jsx';
import ChroniclesCharacterGrimoire from './ChroniclesCharacterGrimoire.jsx';

const style = readFileSync(new URL('./ChroniclesSpellIcon.css', import.meta.url), 'utf8');
const icon = (spell) => renderToStaticMarkup(createElement(ChroniclesSpellIcon, { spell }));

describe('MM3 spell miniatures match the Equipment item-illustration approach', () => {
  it('has an individual original pixel silhouette for every implemented spell', () => {
    const spells = Object.values(CHRONICLES_SPELLS);
    expect(spells).toHaveLength(13);
    expect([...CHRONICLES_SPELL_ICON_IDS].sort()).toEqual(Object.keys(CHRONICLES_SPELLS).sort());
    const portraits = spells.map((spell) => icon(spell));
    expect(new Set(portraits).size).toBe(spells.length);
    for (const [index, spell] of spells.entries()) {
      expect(portraits[index]).toContain(`data-spell-icon="${spell.id}"`);
      expect(portraits[index]).toContain('viewBox="0 0 24 24"');
      expect(portraits[index]).toContain('shape-rendering="crispEdges"');
      expect(portraits[index]).toContain('aria-hidden="true"');
      expect((portraits[index].match(/<path /g) || []).length).toBe(3);
      expect(portraits[index]).not.toContain('<image');
    }
  });

  it('provides an intentional local fallback without pretending unknown spells exist', () => {
    expect(icon({ id: 'future-unknown-spell', kind: 'attack' })).toContain('data-spell-icon="fallback"');
    expect(icon({ id: 'future-unknown-heal', kind: 'heal' })).toContain('data-spell-icon="fallback"');
  });

  it('shows the same icon in every selectable row and its read-only inspector', () => {
    const spells = Object.values(CHRONICLES_SPELLS);
    const html = renderToStaticMarkup(createElement(ChroniclesCharacterGrimoire, {
      spells, availableSp: 9, maxSp: 12, schoolLabel: 'Esoterica',
    }));
    expect((html.match(/data-grimoire-spell="/g) || []).length).toBe(spells.length);
    for (const spell of spells) {
      expect(html).toContain(`data-grimoire-spell="${spell.id}"`);
      expect(html).toContain(`data-spell-icon="${spell.id}"`);
    }
    expect(html).toContain('class="chronicles-sheet-grimoire__detail-icon"');
    expect(html).not.toContain('1. Primeros auxilios');
    expect(html).toContain('Para lanzar, vuelve a la aventura');
    expect(html).not.toContain('Lanzar hechizo');
  });

  it('uses Equipment-scale illustrated tiles without shrinking names, PH or touch rows', () => {
    expect(style).toContain('[data-chronicles-chapter="spells"]');
    expect(style).toContain('grid-template-columns: 38px minmax(0, 1fr) auto');
    expect(style).toContain('min-height: 60px');
    expect(style).toContain('width: 36px');
    expect(style).toContain('height: 36px');
    expect(style).toContain('width: 48px');
    expect(style).toContain('height: 48px');
    expect(style).toContain('background: linear-gradient(145deg, #efc69a, #c48d5e)');
    expect(style).toContain('minmax(0, 1fr) auto');
    expect(style).not.toContain('min-height: 64px');
    expect(style).toContain('image-rendering: pixelated');
    expect(style).not.toContain('chronicles-cast-backdrop');
    expect(style).not.toContain('[data-chronicles-chapter="equipment"]');
  });
});
