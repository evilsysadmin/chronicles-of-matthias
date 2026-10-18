import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesQuickStatusRows } from './chroniclesQuickStatus.js';

describe('Chronicles quick status', () => {
  it('lists every hero with HP, SP, AC, weapon and condition', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const hurt = { ...state, party: state.party.map((member, index) => index === 1 ? { ...member, hp: 0 } : member) };
    const rows = chroniclesQuickStatusRows(hurt, () => 3);
    expect(rows).toHaveLength(state.party.length);
    expect(rows[0]).toMatchObject({ slot: 1, name: state.party[0].name, level: 3 });
    expect(typeof rows[0].armorClass).toBe('number');
    expect(rows[1]).toMatchObject({ hp: 0, condition: 'down', conditionLabel: 'Caído' });
    for (const row of rows) {
      expect(row.weapon).toBeTruthy();
      expect(row.sp === null ? row.maxSp === null : row.maxSp > 0).toBe(true);
    }
  });
});
