import { describe, expect, it } from 'vitest';
import {
  chroniclesEnemyInitiativeAgility,
  chroniclesPartyInitiativeAgility,
  chroniclesRollInitiative,
} from './chroniclesInitiative.js';

const enemy = {
  id: 'horse-thing',
  hpKey: 'horseHp',
  maxHp: 3,
  retaliation: 1,
  ai: { movement: 'knight-chase' },
};

describe('MM3 initiative rejects coerced legacy stats', () => {
  it.each([
    ['boolean true', true],
    ['boolean false', false],
    ['array', [9]],
    ['empty array', []],
    ['object', { value: 9 }],
  ])('ignores %s instead of converting it into agility or speed', (_label, invalid) => {
    const hero = { id: 'matthias', hp: 7, agility: invalid, mm3: { bonuses: { speed: invalid } } };
    const state = { party: [hero], rpgModifiers: { matthias: { initiativeBonus: invalid } } };
    expect(chroniclesPartyInitiativeAgility(state, hero)).toBe(0);
    // Missing or malformed enemy AGI falls back to its authored build.
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: invalid })).toBe(4);
  });

  it('retains legacy numeric strings and legitimate negative MM3 speed', () => {
    const hero = { id: 'matthias', hp: 7, agility: '6', mm3: { bonuses: { speed: '-2' } } };
    const state = { party: [hero], rpgModifiers: { matthias: { initiativeBonus: '3' } } };
    expect(chroniclesPartyInitiativeAgility(state, hero)).toBe(7);
    expect(chroniclesEnemyInitiativeAgility({ ...enemy, agility: '5' })).toBe(5);
  });

  it('rolls AGI + 1d8 using only valid stats, without giving corrupted heroes a free advantage', () => {
    const state = {
      party: [
        { id: 'matthias', hp: 7, agility: [12], mm3: { bonuses: { speed: [9] } } },
        { id: 'rook', hp: 7, agility: '5', mm3: { bonuses: { speed: '-1' } } },
      ],
      rpgModifiers: {
        matthias: { initiativeBonus: true },
        rook: { initiativeBonus: '2' },
      },
      horseHp: 3,
    };
    const rolled = chroniclesRollInitiative(state, [{ ...enemy, agility: [13] }], { random: () => 0 });
    expect(rolled.order.map(({ id, agility, roll, initiative }) => [id, agility, roll, initiative])).toEqual([
      ['rook', 6, 1, 7],
      ['horse-thing', 4, 1, 5],
      ['matthias', 0, 1, 1],
    ]);
  });
});
