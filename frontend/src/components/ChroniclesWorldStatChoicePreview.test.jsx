import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMM3WorldStatOffer } from '../chronicles/chroniclesWorldStatDiscovery.js';
import ChroniclesWorldStatChoice, {
  chroniclesWorldStatChoicePreview,
} from './ChroniclesWorldStatChoice.jsx';

const offer = { label: 'Cristal del barranco · +1 Resistencia', stat: 'endurance', statLabel: 'Resistencia' };
function hero(endurance, hp = 9) {
  return {
    id: 'rook', name: 'Hildegard', hp, maxHp: 15,
    mm3: { stats: { endurance } },
  };
}
function render(selection, party) {
  return renderToStaticMarkup(createElement(ChroniclesWorldStatChoice, {
    offer: selection, party, onSelect: () => {}, onClose: () => {},
  }));
}

describe('MM3 permanent world-stat award choice', () => {
  it('previews actual modifier changes at an MM3 band threshold, including negative bands', () => {
    expect(chroniclesWorldStatChoicePreview(offer, hero(16)))
      .toBe('Resistencia 16 → 17 · bonif. +2 → +3');
    expect(chroniclesWorldStatChoicePreview(offer, hero(15)))
      .toBe('Resistencia 15 → 16 · bonificador igual');
    expect(chroniclesWorldStatChoicePreview(
      { stat: 'might', statLabel: 'Fuerza' },
      { ...hero(12), mm3: { stats: { might: 8 } } },
    )).toBe('Fuerza 8 → 9 · bonif. -2 → -1');
  });

  it('shows honest distinct previews on recipient buttons and keeps wounded/dead choice behavior', () => {
    const active = hero(16);
    const noBand = { ...hero(15), id: 'bishop', name: 'Aziz', hp: 6, maxHp: 8 };
    const down = { ...hero(16, 0), id: 'knight', name: 'Faust' };
    const before = JSON.stringify([active, noBand, down]);
    const html = render(offer, [active, noBand, down]);
    expect(html).toContain('Resistencia 16 → 17 · bonif. +2 → +3');
    expect(html).toContain('Resistencia 15 → 16 · bonificador igual');
    expect(html).toContain('9/15 PV');
    expect(html).toContain('6/8 PV');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Faust[\s\S]*?Fuera de combate/);
    expect(html).toContain('Ahora no');
    expect(JSON.stringify([active, noBand, down])).toBe(before);
  });

  it('uses real effective stats of a crystal discovery without consuming its receipt or XP', () => {
    const progression = createChroniclesProgression();
    const initial = applyChroniclesProgressionToTacticsState(
      createChroniclesState('swordhaven-first-book', progression.characterBuild, { rules: 'mm3' }),
      progression,
    );
    const atCrystal = { ...initial, x: 9, y: 14, direction: 0, runProgression: progression };
    const found = chroniclesMM3WorldStatOffer(atCrystal);
    expect(found?.stat).toBe('endurance');
    const prior = JSON.stringify(atCrystal.party);
    const html = render(found, atCrystal.party);
    atCrystal.party.forEach((member) => {
      const before = member.mm3.stats.endurance;
      expect(html).toContain(`Resistencia ${before} → ${before + 1}`);
    });
    expect(JSON.stringify(atCrystal.party)).toBe(prior);
    expect(atCrystal.swordhavenEnduranceCrystalClaimed).not.toBe(true);
    expect(progression.claimedWorldStatSources).toEqual([]);
  });

  it('falls back safely with old/non-MM3 party records, never guessing a modifier', () => {
    const withoutSheet = { id: 'matthias', name: 'Matthias', hp: 8, maxHp: 8 };
    expect(chroniclesWorldStatChoicePreview(offer, withoutSheet)).toBeNull();
    expect(chroniclesWorldStatChoicePreview({ ...offer, stat: 'unknown' }, hero(16))).toBeNull();
    expect(chroniclesWorldStatChoicePreview(offer, { ...hero(16), mm3: { stats: { endurance: '16' } } })).toBeNull();
    const html = render(offer, [withoutSheet]);
    expect(html).toContain('8/8 PV · +1 Resistencia');
    expect(html).not.toContain('bonif.');
  });
});
