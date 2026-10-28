import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesMM3MeleeAvailable,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';

const GOBLIN = 'sewers-goblin-west';

function positionedFight(distance = 2, direction = 2) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const others = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== GOBLIN)
    .map((enemy) => [enemy.hpKey, 0]));
  return {
    ...base, ...others, x: 1, y: 1, direction,
    enemyPositions: { [GOBLIN]: { x: 1, y: 1 + distance } },
    phase: 'combat',
    initiative: {
      round: 1, cursor: 0,
      order: [{ kind: 'party', id: 'matthias' }, { kind: 'enemy', id: GOBLIN }],
    },
  };
}

describe('MM3 melee reach feedback and action cost', () => {
  it('disables sword reach at two cells and refuses A without consuming the hero turn', () => {
    const far = positionedFight(2);
    expect(chroniclesMM3MeleeAvailable(far, 'matthias')).toBe(false);
    const refused = chroniclesReduce(far, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(refused).toBe(far);
    expect(refused.turns).toBe(far.turns);
    expect(refused.initiative).toBe(far.initiative);
  });

  it('attacks an adjacent engaged enemy without rotating the group, including at the side', () => {
    const adjacent = positionedFight(1);
    for (const direction of [2, 1]) {
      const fixed = { ...adjacent, direction };
      expect(chroniclesMM3MeleeAvailable(fixed, 'matthias')).toBe(true);
      const swung = chroniclesReduce(fixed, { type: 'attack', memberId: 'matthias', mode: 'melee' });
      expect(swung).not.toBe(fixed);
      expect(swung.turns).toBe(fixed.turns + 1);
      expect(swung.direction).toBe(direction);
    }
    // Outside initiative, looking somewhere else does NOT grant side reach.
    const exploring = { ...adjacent, initiative: null, phase: 'explore', direction: 1 };
    expect(chroniclesMM3MeleeAvailable(exploring, 'matthias')).toBe(false);
  });

  it('does not enable another hero or enemy actor during a different initiative slot', () => {
    const close = positionedFight(1);
    expect(chroniclesMM3MeleeAvailable(close, 'rook')).toBe(false);
    expect(chroniclesMM3MeleeAvailable({ ...close, initiative: { ...close.initiative, cursor: 1 } }, 'matthias')).toBe(false);
    const dead = { ...close, party: close.party.map((hero) => hero.id === 'matthias' ? { ...hero, hp: 0 } : hero) };
    expect(chroniclesMM3MeleeAvailable(dead, 'matthias')).toBe(false);
  });

  it('does not modify independent Tactics attack semantics or ranged volleys', () => {
    const mm3 = positionedFight(2);
    const tactics = { ...mm3, combatRules: null };
    expect(chroniclesMM3MeleeAvailable(tactics, 'matthias')).toBe(true);
    const oldSwing = chroniclesReduce(tactics, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(oldSwing.turns).toBe(tactics.turns + 1);
    const volley = chroniclesReduce({ ...mm3, initiative: null, phase: 'explore' }, { type: 'volley' });
    expect(volley).toBeDefined(); // The dedicated salvo rule is unchanged.
  });
});
