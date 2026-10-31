import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesCharacterGrimoire from './ChroniclesCharacterGrimoire.jsx';
import { CHRONICLES_SPELLS } from '../chronicles/chroniclesMagic.js';

const workspace = readFileSync(new URL('./ChroniclesCharacterGrimoireWorkspace.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('./ChroniclesCharacterGrimoire.jsx', import.meta.url), 'utf8');
const spells = [CHRONICLES_SPELLS['first-aid'], CHRONICLES_SPELLS['flying-fist']];

describe('MM3 spell catalogue follows full-width Equipment workspace', () => {
  it('shows a single Examinar action and hidden read-only spell dialog', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesCharacterGrimoire, {
      spells, availableSp: 2, maxSp: 8, schoolLabel: 'Esoterica',
    }));
    expect(html).toContain('data-chronicles-grimoire');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('class="chronicles-sheet-grimoire__inspection-scrim" hidden=""');
    expect(html).toContain('aria-label="Cerrar inspección de hechizo"');
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html).toContain('aria-label="Examinar Primeros auxilios"');
    expect(html).toContain('Cura 6 PV');
    expect(html).toContain('2/8 PH actuales');
    expect(html).not.toContain('Lanzar hechizo');
    expect(html.match(/⌕ Examinar/g)).toHaveLength(1);
    expect(source).toContain('inspectTriggerRef.current?.focus()');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain("event.key === 'Escape'");
  });

  it('uses the entire desktop sheet without changing other folios or Tactics', () => {
    expect(workspace).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(workspace).toContain('[data-chronicles-chapter="spells"]');
    expect(workspace).toContain('grid-template-columns: minmax(0, 1fr) clamp(152px, 11vw, 188px)');
    expect(workspace).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(workspace).toContain('max-height: none;');
    expect(workspace).toContain('flex: 1 1 auto;');
    expect(workspace).toContain('min-height: 0;');
    expect(workspace).toContain('width: min(610px, 100%);');
    expect(workspace).toContain('.chronicles-sheet-grimoire__inspection-scrim[hidden]');
    expect(workspace).toContain('max-height: calc(100dvh - 16px)');
    expect(workspace).not.toContain('[data-chronicles-chapter="equipment"]');
    expect(workspace).not.toContain('chronicles-cast-backdrop');
    expect(source).toContain("import './ChroniclesCharacterGrimoireWorkspace.css'");
  });

  it('does not invent inspection or cast actions for empty spellbooks', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesCharacterGrimoire, {
      spells: [], availableSp: 0, maxSp: 0, schoolLabel: 'Gaiam',
    }));
    expect(html).toContain('No hay hechizos de este tipo');
    expect(html).toContain('class="chronicles-sheet-grimoire__inspect-trigger"');
    expect(html).toMatch(/aria-haspopup="dialog"[^>]*disabled=""/);
    expect(html).not.toContain('data-grimoire-spell=');
  });
});
