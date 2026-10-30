import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const skin = readFileSync(new URL('./ChroniclesCharacterRetroMM3.css', import.meta.url), 'utf8');
const mm3Selector = '.chronicles-character-sheet--mm3.chronicles-character-sheet--folio-v2';

function render(mode = 'chronicles', folio = 'record') {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state,
    progression: createChroniclesProgression(),
    member: state.party[0],
    mode,
    initialFolio: folio,
    onClose: () => {},
  }));
}

describe('MM3 retro skin and compact record layout', () => {
  it('keeps real attributes, unified equipment list, navigation and party selector', () => {
    const html = render();
    for (const key of ['might', 'intellect', 'personality', 'endurance', 'speed', 'accuracy', 'luck']) {
      expect(html).toContain(`data-stat="${key}"`);
      expect(skin).toContain(`[data-stat='${key}']::before`);
    }
    const inventory = render('chronicles', 'equipment');
    expect(inventory).toContain('chronicles-character-sheet__backpack');
    expect(inventory).toContain('aria-label="Acciones de inventario"');
    expect(inventory).toContain('aria-keyshortcuts="I"');
    expect(inventory).not.toContain('chronicles-equipment-technical-details');
    expect(inventory).not.toContain('class="chronicles-character-sheet__equipped-disclosure"');
    // Equipped objects remain in the single selectable ledger. Examinar
    // shows the chosen object's actual mechanics rather than duplicate slots.
    expect(html).not.toContain('data-chronicles-worn-gear');
    for (const title of ['Estado', 'Equipo', 'Hechizos', 'Mejoras']) expect(html).toContain(title);
    expect(html).toContain('aria-label="Seleccionar personaje de la compañía"');
    expect(html).not.toContain('Cambiar equipo');
    expect(html).not.toContain('data-chronicles-worn-gear');
    expect(inventory).toContain('chronicles-character-sheet__backpack');
    // A fresh hero need not start with any equipped slots; the populated
    // equipment fixture is exercised by ChroniclesCharacterInventoryRetro.
  });

  it('keeps Tactics out of the opt-in retro skin and sizes new grids only on roomy desktop', () => {
    expect(render('tactics')).not.toContain('chronicles-character-sheet--mm3');
    expect(render()).toContain('chronicles-character-sheet--folio-v2');
    expect(skin).toContain('@media (min-width: 1200px) and (min-height: 650px)');
    expect(skin).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(skin).toContain('@media (max-width: 1199px), (max-height: 649px)');
    expect(skin).toContain('@media (prefers-reduced-motion: reduce)');
    expect(skin).not.toMatch(/display:\s*none\s*!important/);
    expect(skin).not.toContain('pointer-events: none');
  });
});
