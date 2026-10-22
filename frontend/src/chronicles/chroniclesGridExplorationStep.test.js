import { describe, it, expect, vi } from 'vitest';
import { chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesEnemyCanAttackParty } from '../chroniclesOfMatthiasTurns.js';

vi.mock('../chroniclesOfMatthias.js', () => ({
  chroniclesReduce: vi.fn((state, action) => action === 'forward'
    ? { ...state, x: state.x + 1 }
    : action === 'transition'
      ? { ...state, mapId: 'crypt-eight-squares', x: 1, y: 5 }
    : action === 'blocked'
      ? { ...state, message: 'pared' }
      : { ...state, direction: (state.direction + 1) % 4 }),
  chroniclesActiveEnemies: vi.fn(() => [{ id: 'sentinel' }]),
}));
vi.mock('../chroniclesOfMatthiasTurns.js', () => ({
  chroniclesEnemyCanAttackParty: vi.fn(() => false),
  chroniclesRememberEnemySight: vi.fn((state, enemy) => ({
    ...state,
    enemyAwareness: {
      ...(state.enemyAwareness || {}),
      [enemy.id]: { x: state.x, y: state.y, tick: state.explorationEnemySteps },
    },
  })),
  chroniclesRuntimeEnemyPosition: vi.fn((state) => state.enemyPositions?.sentinel || { x: 4, y: 2 }),
  chroniclesChooseEnemyStep: vi.fn((state) => {
    const p = state.enemyPositions?.sentinel || { x: 4, y: 2 };
    return { x: p.x - 1, y: p.y };
  }),
}));
describe('one party tile, one enemy move', () => {
  const state = { x: 1, y: 1, direction: 0, phase: 'explore', enemyPositions: { sentinel: { x: 4, y: 2 } } };
  it('moves enemies exactly once after a successful tile step', () => {
    const first = chroniclesGridExplorationStep(state, 'forward');
    expect(first.x).toBe(2);
    expect(first.enemyPositions.sentinel).toEqual({ x: 3, y: 2 });
    expect(first.explorationEnemySteps).toBe(1);
    expect(first.enemyAwareness.sentinel).toEqual({ x: 2, y: 1, tick: 1 });
    const second = chroniclesGridExplorationStep(first, 'forward');
    expect(second.enemyPositions.sentinel).toEqual({ x: 2, y: 2 });
    expect(second.explorationEnemySteps).toBe(2);
    expect(second.enemyAwareness.sentinel).toEqual({ x: 3, y: 1, tick: 2 });
  });
  it('enters initiative without giving an in-reach enemy a free escape move', () => {
    chroniclesEnemyCanAttackParty.mockReturnValueOnce(true);
    const next = chroniclesGridExplorationStep(state, 'forward');
    expect(next.x).toBe(2);
    expect(next.enemyPositions).toEqual(state.enemyPositions);
    expect(next.explorationEnemySteps).toBe(1);
  });
  it('does not move destination enemies during an authored area transition', () => {
    const before = { ...state, mapId: 'swordhaven-square' };
    const arrived = chroniclesGridExplorationStep(before, 'transition');
    expect(arrived.mapId).toBe('crypt-eight-squares');
    expect(arrived.enemyPositions).toEqual(before.enemyPositions);
    expect(arrived.explorationEnemySteps).toBeUndefined();
  });
  it('does not activate an enemy for turning in place', () => {
    const turned = chroniclesGridExplorationStep(state, 'turn-right');
    expect(turned.enemyPositions).toEqual(state.enemyPositions);
    expect(turned.explorationEnemySteps).toBeUndefined();
  });
  it('never moves an enemy after a blocked step', () => {
    const blocked = chroniclesGridExplorationStep(state, 'blocked');
    expect(blocked.enemyPositions).toEqual(state.enemyPositions);
    expect(blocked.message).toBe('pared');
    expect(blocked.explorationEnemySteps).toBeUndefined();
  });
  it('does not grant exploration movement during initiative combat', () => {
    const combat = { ...state, phase: 'combat' };
    const resolved = chroniclesGridExplorationStep(combat, 'forward');
    expect(resolved.enemyPositions).toEqual(combat.enemyPositions);
    expect(resolved.explorationEnemySteps).toBeUndefined();
  });
  it('advances from a restored exploration clock without double-ticking other actions', () => {
    const saved = { ...state, explorationEnemySteps: 17, enemyAwareness: { ancient: { tick: 14 } } };
    const moved = chroniclesGridExplorationStep(saved, 'forward');
    expect(moved.explorationEnemySteps).toBe(18);
    expect(moved.enemyAwareness.ancient).toEqual({ tick: 14 });
    expect(chroniclesGridExplorationStep(moved, 'turn-right').explorationEnemySteps).toBe(18);
  });
});
