import { describe, expect, it } from 'vitest';
import {
  chroniclesPartyInitiativeAgility,
  chroniclesRollInitiative,
} from './chroniclesInitiative.js';

describe('Chronicles MM3 initiative speed bonus integrity', () => {
  const hero = { id: 'matthias', name: 'Matthias', hp: 7, agility: 5 };
  const withSpeed = (speed) => ({
    party: [{ ...hero, mm3: { bonuses: { speed } } }],
    rpgModifiers: { matthias: { initiativeBonus: 1 } },
  });

  it.each([1.5, -2.5, Number.MAX_SAFE_INTEGER + 1, -Infinity, 'not-a-number'])(
    'ignores malformed speed bonus %s instead of introducing invalid initiative',
    (speed) => {
      const state = withSpeed(speed);
      expect(chroniclesPartyInitiativeAgility(state, state.party[0])).toBe(6);
      const rolled = chroniclesRollInitiative(state, [], { random: () => 0 });
      expect(rolled.order[0]).toMatchObject({
        id: 'matthias', agility: 6, roll: 1, initiative: 7,
      });
      expect(Number.isSafeInteger(rolled.order[0].initiative)).toBe(true);
    },
  );

  it('preserves valid positive and negative integer speed modifiers', () => {
    expect(chroniclesPartyInitiativeAgility(withSpeed(2), withSpeed(2).party[0])).toBe(8);
    const slowed = withSpeed(-3);
    expect(chroniclesPartyInitiativeAgility(slowed, slowed.party[0])).toBe(3);
    const rolled = chroniclesRollInitiative(slowed, [], { random: () => 0.999 });
    expect(rolled.order[0]).toMatchObject({
      agility: 3, roll: 8, initiative: 11,
    });
  });
});
