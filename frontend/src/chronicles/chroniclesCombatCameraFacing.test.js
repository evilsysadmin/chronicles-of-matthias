import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesMM3MeleeAvailable,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesCombatCameraFacing } from './chroniclesCombatCameraFacing.js';

const ID = 'sewers-goblin-west';
function realFlankFight({ x = 1, y = 2, direction = 0, distance = 1 } = {}) {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === ID);
  expect(goblin).toBeTruthy();
  const others = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((enemy) => enemy.id !== ID).map((enemy) => [enemy.hpKey, 0]));
  return {
    ...base, ...others, x: 1, y: 1, direction, phase: 'combat',
    enemyPositions: { [ID]: { x, y: y === 2 ? 1 + distance : y } },
    initiative: { round: 1, cursor: 0, order: [
      { kind: 'party', id: 'matthias' }, { kind: 'enemy', id: ID },
    ] },
  };
}

describe('MM3 encounter camera focuses real melee threats, not masonry', () => {
  it('looks at an adjacent goblin behind the camera without rotating the party or consuming turns', () => {
    const fight = realFlankFight(); // group faces north; goblin attacks from south
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(ID);
    expect(chroniclesMM3MeleeAvailable(fight, 'matthias')).toBe(true);
    expect(chroniclesCombatCameraFacing(fight)).toBe(2);
    expect(fight.direction).toBe(0);
    expect(chroniclesReduce(fight, 'turn-left')).toBe(fight);
    expect(chroniclesReduce(fight, 'turn-right')).toBe(fight);
    const swung = chroniclesReduce(fight, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(swung.turns).toBe(fight.turns + 1);
    expect(swung.direction).toBe(0);
  });

  it('honours the original forward-facing shot and never invents a target', () => {
    const facing = realFlankFight({ direction: 2 });
    expect(chroniclesCombatCameraFacing(facing)).toBe(2);
    const distant = realFlankFight({ distance: 2 });
    expect(chroniclesCombatMeleeTarget(distant)).toBeNull();
    expect(chroniclesCombatCameraFacing(distant)).toBe(0);
    const dead = { ...facing, 'sewersGoblinWestHp': 0 };
    // The HP key in the authored map is canonical, not the fake string above.
    const enemy = chroniclesActiveEnemies(facing).find((entry) => entry.id === ID);
    const deadReal = { ...dead, [enemy.hpKey]: 0 };
    expect(chroniclesCombatCameraFacing(deadReal)).toBe(2);
  });

  it('leaves exploration and independent Tactics camera control unchanged', () => {
    const fight = realFlankFight();
    expect(chroniclesCombatCameraFacing({ ...fight, initiative: null, phase: 'explore' })).toBe(0);
    expect(chroniclesCombatCameraFacing({ ...fight, combatRules: null })).toBe(0);
    expect(chroniclesCombatCameraFacing({ ...fight, phase: 'defeated' })).toBe(0);
  });
});
