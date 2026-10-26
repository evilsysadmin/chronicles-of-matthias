import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesCharacterGrimoire from './ChroniclesCharacterGrimoire.jsx';
import { CHRONICLES_SPELLS } from '../chronicles/chroniclesMagic.js';

const skin = readFileSync(new URL('./ChroniclesCharacterGrimoireRetro.css', import.meta.url), 'utf8');

const spells = [CHRONICLES_SPELLS['first-aid'], CHRONICLES_SPELLS['flying-fist']];

describe('MM3 compact spellbook visual skin', () => {
  it('preserves real spellbook data, costs, selection and the read-only casting boundary', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesCharacterGrimoire, {
      spells, availableSp: 2, maxSp: 8, schoolLabel: 'Esoterica',
    }));
    expect(html).toContain('data-chronicles-grimoire');
    expect(html).toContain('Primeros auxilios');
    expect(html).toContain('Puño volador');
    expect(html).toContain('2/8 PH actuales');
    expect(html).toContain('aria-label="Filtrar hechizos"');
    expect(html).toContain('data-grimoire-spell');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Magia (C)');
    expect(html).not.toContain('Lanzar hechizo');
  });

  it('keeps min-size inputs, real selected state, and safe desktop-only scope', () => {
    expect(skin).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(skin).toContain('.chronicles-character-sheet--mm3.chronicles-character-sheet--folio-v2');
    expect(skin).toContain('min-height: 44px');
    expect(skin).toContain(".chronicles-sheet-grimoire__filter button[aria-pressed='true']");
    expect(skin).toContain('.chronicles-sheet-grimoire__list button.is-selected');
    expect(skin).toContain('grid-template-columns: minmax(240px, 1fr) minmax(270px, 1fr)');
    expect(skin).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
    expect(skin).not.toContain('@media (max-width: 850px)');
  });

  it('keeps selected labels and PH costs readable against their real backgrounds', () => {
    const block = (selector) => {
      const start = skin.indexOf(selector + ' {');
      expect(start).toBeGreaterThanOrEqual(0);
      return skin.slice(start, skin.indexOf('}', start));
    };
    const color = (declarations, property) => {
      const match = declarations.match(new RegExp('(?:^|\\n)\\s*' + property + ':\\s*(#[0-9a-f]{6})\\s*;', 'i'));
      expect(match).not.toBeNull();
      return match[1];
    };
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const contrast = (foreground, background) => {
      const a = luminance(foreground);
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const row = block('.chronicles-sheet-grimoire__list button');
    const selected = block('.chronicles-sheet-grimoire__list button.is-selected');
    const cost = block('.chronicles-sheet-grimoire__cost');
    const selectedCost = block('.chronicles-sheet-grimoire__list button.is-selected .chronicles-sheet-grimoire__cost');
    expect(contrast(color(selected, 'color'), color(selected, 'background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(cost, 'color'), color(row, 'background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color(selectedCost, 'color'), color(selected, 'background'))).toBeGreaterThanOrEqual(4.5);
  });
});
