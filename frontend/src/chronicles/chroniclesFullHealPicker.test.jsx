import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChroniclesHealTargetPicker } from '../components/ChroniclesSpellMenu.jsx';
import { CHRONICLES_SPELLS } from './chroniclesMagic.js';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import React from 'react';

describe('MM3 healthy spell targeting', () => {
  it('offers healthy heroes as selectable cure targets while fallen stay disabled', () => {
    const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const state = { ...base, party: base.party.map((hero) => hero.id === 'rook' ? { ...hero, hp: 0 } : hero) };
    const html = renderToStaticMarkup(<ChroniclesHealTargetPicker
      state={state} spell={CHRONICLES_SPELLS['first-aid']}
      onSelect={() => {}} onBack={() => {}} />);
    expect(html).toMatch(/data-chronicles-heal-target="matthias"[^>]*title="Salud completa · consume PH sin efecto"/);
    expect(html).toMatch(/data-chronicles-heal-target="rook"[^>]*disabled=""/);
    expect(html).toContain('SANO · SIN EFECTO');
  });
});
