import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesQuickStatusRows } from './chroniclesQuickStatus.js';

describe('Chronicles quick status', () => {
  it('lists every hero with HP, SP, AC, weapon and condition', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const hurt = { ...state, party: state.party.map((member, index) => index === 1 ? { ...member, hp: 0 } : member) };
    const rows = chroniclesQuickStatusRows(hurt);
    expect(rows).toHaveLength(state.party.length);
    expect(rows[0]).toMatchObject({ slot: 1, name: state.party[0].name });
    expect(rows[0]).not.toHaveProperty('level');
    expect(typeof rows[0].armorClass).toBe('number');
    expect(rows[1]).toMatchObject({ hp: 0, condition: 'down', conditionLabel: 'Caído' });
    for (const row of rows) {
      expect(row.weapon).toBeTruthy();
      expect(row.sp === null ? row.maxSp === null : row.maxSp > 0).toBe(true);
    }
  });
});

describe('Chronicles status numbers match the hero keyboard shortcuts', () => {
  it('labels reversed party state in the canonical 1–4 order', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const reversed = { ...state, party: [...state.party].reverse() };
    const rows = chroniclesQuickStatusRows(reversed);
    expect(rows.map(({ slot, id }) => [slot, id])).toEqual([
      [1, 'matthias'], [2, 'rook'], [3, 'bishop'], [4, 'knight'],
    ]);
  });
  it('does not renumber a remaining hero when another canonical slot is missing', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const subset = { ...state, party: state.party.filter((member) => member.id === 'knight' || member.id === 'matthias') };
    expect(chroniclesQuickStatusRows(subset).map(({ slot, id }) => [slot, id]))
      .toEqual([[1, 'matthias'], [4, 'knight']]);
  });
});
