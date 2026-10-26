import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const skin = readFileSync(new URL('./ChroniclesCharacterTrainingRetro.css', import.meta.url), 'utf8');

function render(mode = 'chronicles') {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state,
    progression: createChroniclesProgression(),
    member: state.party[0],
    mode,
    initialFolio: 'training',
    onClose: () => {},
  }));
}
describe('Chronicles classic MM3 training ledger', () => {
  it('presents two real, separately labeled progression chapters without inventing XP or unlocked techniques', () => {
    const html = render();
    expect(html).toContain('data-chronicles-training="attributes"');
    expect(html).toContain('data-chronicles-training="skills"');
    expect(html).toContain('ATRIBUTOS');
    expect(html).toContain('TÉCNICAS Y GRIMORIO');
    expect(html).toContain('puntos libres');
    expect(html).toContain('Requiere Nv');
    expect(html).toContain('aria-pressed="true"');
  });
  it('does not change rules, Tactics, mobile controls or keyboard accessibility', () => {
    const tactics = render('tactics');
    expect(tactics).not.toContain('chronicles-character-sheet--mm3');
    expect(skin).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(skin).toContain('min-height: 58px');
    expect(skin).toContain("button.is-learned");
    expect(skin).toContain("button:not(:disabled):focus-visible");
    expect(skin).toContain('repeat(3, minmax(0, 1fr))');
    expect(skin).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
  });
});
