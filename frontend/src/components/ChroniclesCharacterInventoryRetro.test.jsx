import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const css = readFileSync(new URL('./ChroniclesCharacterInventoryRetro.css', import.meta.url), 'utf8');

function html(mode = 'chronicles') {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  const inventory = { 'brass-dagger': { id: 'brass-dagger', name: 'Daga de latón', quantity: 2 } };
  const owned = { matthias: { 'brass-dagger': 2 } };
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state: { ...state, inventory, bagOwners: owned },
    progression: createChroniclesProgression(),
    member: state.party[0],
    mode,
    initialFolio: 'equipment',
    onClose: () => {},
    onEquipmentAction: () => {},
  }));
}

describe('Chronicles MM3 inventory chapter skin', () => {
  it('retains an actionable, select-first item list and actual equip controls', () => {
    const rendered = html();
    expect(rendered).toContain('data-chronicles-equipment-folio="matthias"');
    expect(rendered).toContain('data-inventory-item="brass-dagger"');
    expect(rendered).toContain('aria-pressed="false"');
    expect(rendered).toContain('Mochila de Matthias');
    expect(rendered).toContain('Equipar Daga de latón');
    expect(rendered).not.toContain('chronicles-character-sheet__handoff-targets');
    expect(rendered).toContain('Vista previa · selecciónalo para entregarlo');
    expect(rendered).toContain('class="chronicles-character-sheet__item-details" aria-live="polite"');
    expect(rendered).not.toContain('chronicles-character-sheet__inventory-hint');
    expect(rendered).toContain('data-slot="weapon"');
    expect(rendered).toContain('data-slot="missile"');
  });

  it('changes only desktop visual treatment; mobile and Tactics do not inherit extra behavior', () => {
    expect(html('tactics')).not.toContain('chronicles-character-sheet--mm3');
    expect(css).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(css).toContain('[data-chronicles-equipment-folio]');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('text-overflow: ellipsis');
    expect(css).toContain('button:focus-visible');
    // Selected rows must retain dark readable text on the light copper surface.
    expect(css).toMatch(/button\.is-selected\s*\{[^}]*color:\s*#3b250f;/);
    expect(css).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
    expect(css).not.toContain('content: \'1)\'');
  });
});