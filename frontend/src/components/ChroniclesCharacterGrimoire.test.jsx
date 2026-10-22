import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesCharacterGrimoire from './ChroniclesCharacterGrimoire.jsx';
import { CHRONICLES_SPELLS } from '../chronicles/chroniclesMagic.js';

const spells = [
  CHRONICLES_SPELLS['first-aid'],
  CHRONICLES_SPELLS['flying-fist'],
  CHRONICLES_SPELLS['faith-ward'],
];

describe('Character folio MM3 grimoire', () => {
  it('uses actual known spells, costs and readable selected detail; never casts from a consultation screen', () => {
    const html = renderToStaticMarkup(
      <ChroniclesCharacterGrimoire spells={spells} availableSp={1} maxSp={6} schoolLabel="Esoterica" />,
    );
    expect(html).toContain('Primeros auxilios');
    expect(html).toContain('Puño volador');
    expect(html).toContain('Escudo de fe');
    expect(html).toContain('Cura 6 PV');
    expect(html).toContain('1/6 PH actuales');
    expect(html).toContain('Magia (C)');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('onClick="cast"');
  });

  it('does not invent spells, gold prices or available casting for an empty book', () => {
    const html = renderToStaticMarkup(
      <ChroniclesCharacterGrimoire spells={[]} availableSp={0} maxSp={0} schoolLabel="Gaiam" />,
    );
    expect(html).toContain('No hay hechizos de este tipo');
    expect(html).not.toContain('Primeros auxilios');
  });

  it('marks insufficient PH without mutating the character', () => {
    const html = renderToStaticMarkup(
      <ChroniclesCharacterGrimoire spells={[CHRONICLES_SPELLS['flying-fist']]}
        availableSp={0} maxSp={2} schoolLabel="Esoterica" />,
    );
    expect(html).toContain('PH insuficientes');
    expect(html).toContain('data-can-afford="false"');
  });
});
