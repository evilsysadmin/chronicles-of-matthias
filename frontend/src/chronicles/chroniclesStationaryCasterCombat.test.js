import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesChooseEnemyStep, chroniclesEnemyAttackTarget, chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

const ID = 'vault-wisp';
function encounter() {
  const base = createChroniclesState('ash-vault', null, { rules: 'mm3' });
  return {
    ...base,
    ...Object.fromEntries(chroniclesActiveEnemies(base).filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 5, y: 3, direction: 0, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 6, y: 1 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('MM3 engaged stationary wisp fallback', () => {
  it('acquires a real firing lane with one spent move and fires only on a later action', () => {
    const before = encounter();
    const wisp = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(wisp.ai).toMatchObject({ movement: 'hold', attackReach: 2, requiresLineOfSight: true });
    expect(wisp.ai.engagedMovement).toBeUndefined();
    expect(chroniclesEnemyAttackTarget(before, wisp)).toBeNull();
    const moved = chroniclesResolveEnemyActor(before, ID);
    expect(moved.enemyTurnEvents).toEqual([{ type: 'move', enemyId: ID, from: { x: 6, y: 1 }, to: { x: 5, y: 1 } }]);
    expect(moved.party).toEqual(before.party);
    expect(moved.direction).toBe(before.direction);
    expect(moved.initiative).toEqual(before.initiative);
    expect(chroniclesEnemyAttackTarget(moved, wisp)).toBeTruthy();
    expect(chroniclesChooseEnemyStep(moved, wisp)).toBeNull();
    const fired = chroniclesResolveEnemyActor(moved, ID);
    expect(fired.enemyTurnEvents.map(event => event.type)).toEqual(['attack']);
    expect(fired.enemyPositions).toEqual(moved.enemyPositions);
  });

  it('preserves unengaged, exploration, Tactics and paralysis behavior', () => {
    const before = encounter();
    const wisp = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    for (const state of [
      { ...before, phase: 'explore', initiative: null },
      { ...before, initiative: { ...before.initiative, order: [{ kind: 'party', id: 'matthias' }] } },
      { ...before, combatRules: null },
    ]) expect(chroniclesChooseEnemyStep(state, wisp)).toBeNull();
    const held = { ...before, enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents).toEqual([{ type: 'paralyzed', enemyId: ID, left: 0 }]);
    expect(after.enemyPositions).toEqual(held.enemyPositions);
    expect(after.party).toEqual(held.party);
  });
});
