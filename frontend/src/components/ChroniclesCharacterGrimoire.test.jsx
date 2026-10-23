import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesCharacterGrimoire, { chroniclesGrimoireNextSelection } from './ChroniclesCharacterGrimoire.jsx';
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

  it('uses one Tab stop for the selected spell even when several are known', () => {
    const html = renderToStaticMarkup(
      <ChroniclesCharacterGrimoire spells={spells} availableSp={3} maxSp={6} schoolLabel="Esoterica" />,
    );
    const rows = [...html.matchAll(/<button[^>]*data-grimoire-spell="[^"]+"[^>]*>/g)]
      .map((match) => match[0]);
    expect(rows).toHaveLength(spells.length);
    expect(rows.filter((row) => row.includes('tabindex="0"'))).toHaveLength(1);
    expect(rows.filter((row) => row.includes('tabindex="-1"'))).toHaveLength(spells.length - 1);
    expect(rows[0]).toContain('aria-pressed="true"');
    expect(rows.slice(1).every((row) => row.includes('aria-pressed="false"'))).toBe(true);
    expect(html).toContain('Tab · entrar/salir de la lista');
  });

  it('moves inside only the visible spell list, wraps, and never mutates spells', () => {
    const original = JSON.stringify(spells);
    const first = spells[0].id;
    const second = spells[1].id;
    const last = spells[spells.length - 1].id;
    expect(chroniclesGrimoireNextSelection(spells, first, 'ArrowDown')).toBe(second);
    expect(chroniclesGrimoireNextSelection(spells, first, 'ArrowUp')).toBe(last);
    expect(chroniclesGrimoireNextSelection(spells, last, 'ArrowDown')).toBe(first);
    expect(chroniclesGrimoireNextSelection(spells, last, 'Home')).toBe(first);
    expect(chroniclesGrimoireNextSelection(spells, first, 'End')).toBe(last);
    expect(chroniclesGrimoireNextSelection(spells.slice(1), first, 'ArrowDown')).toBe(last);
    expect(chroniclesGrimoireNextSelection([], first, 'ArrowDown')).toBeNull();
    expect(chroniclesGrimoireNextSelection(spells, first, 'Tab')).toBeNull();
    expect(JSON.stringify(spells)).toBe(original);
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
