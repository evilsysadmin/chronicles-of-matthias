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
});
