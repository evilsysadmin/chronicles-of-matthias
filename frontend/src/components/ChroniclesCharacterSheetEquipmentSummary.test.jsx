import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const render = (rules, folio = 'equipment') => {
  const state = createChroniclesState('swordhaven-first-book', null, { rules });
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, progression: createChroniclesProgression(), member: state.party[0],
    mode: 'chronicles', initialFolio: folio, onClose: () => {},
  }));
};

describe('Chronicles character sheet combat summary', () => {
  it('labels first-person MM3 equipment A separately from ranged S and never sells numeric damage reduction', () => {
    const html = render('mm3');
    expect(html).toContain('Equipo A: daño');
    expect(html).toContain('El disparo S usa sus propios bonos');
    expect(html).toContain('CA del equipo');
    expect(html).toContain('dificulta impactos, no resta daño');
    expect(html).not.toMatch(/CA \+\d+ · reducción \d+/);
    expect(html).not.toContain('mitigación');
  });

  it('retains the distinct legacy damage reduction summary', () => {
    const html = render(null);
    expect(html).toContain('mitigación');
    expect(html).not.toContain('CA del equipo');
    expect(html).not.toContain('El disparo S usa sus propios bonos');
  });
});
