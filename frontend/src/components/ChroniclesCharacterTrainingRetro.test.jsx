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
describe('Chronicles MM3 progression split from Tactics training', () => {
  it('shows only classic MM3 attributes and chapters, even for an old training deep link', () => {
    const html = render();
    expect(html).not.toContain('data-chronicles-training');
    expect(html).not.toContain('TÉCNICAS Y GRIMORIO');
    expect(html).not.toContain('puntos libres');
    expect(html).not.toContain('Mejoras');
    expect(html).toContain('data-stat="endurance"');
    expect(html).toContain('Estado');
    expect(html).toContain('Hechizos');
    expect(html).toContain('aria-pressed="true"');
  });
  it('keeps Tactics training, mobile controls and keyboard accessibility', () => {
    const tactics = render('tactics');
    expect(tactics).not.toContain('chronicles-character-sheet--mm3');
    expect(tactics).toContain('data-chronicles-training="attributes"');
    expect(tactics).toContain('data-chronicles-training="skills"');
    expect(tactics).toContain('TÉCNICAS Y GRIMORIO');
    expect(skin).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(skin).toContain('min-height: 58px');
    expect(skin).toContain("button.is-learned");
    expect(skin).toContain("button:not(:disabled):focus-visible");
    expect(skin).toContain('.chronicles-character-sheet__attribute-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(skin).not.toContain('repeat(3, minmax(0, 1fr))');
    expect(skin).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
  });
});
