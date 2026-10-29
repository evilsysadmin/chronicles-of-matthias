import { describe, expect, it } from 'vitest';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

const partyState = {
  phase: 'explore',
  combatRules: 'mm3',
  x: 0,
  y: 0,
  party: [{ id: 'matthias', hp: 12 }],
};

describe('MM3 malformed enemy roster at combat startup', () => {
  it('ignores null and missing roster slots instead of throwing', () => {
    expect(chroniclesStartInitiativeCombat(partyState, [null, undefined]))
      .toBe(partyState);
  });

  it('does not start a phantom forced engagement from empty roster slots', () => {
    expect(chroniclesStartInitiativeCombat(
      partyState,
      [null, undefined],
      { forceEnemyIds: ['goblin'] },
    )).toBe(partyState);
  });
});
