import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesChooseEnemyStep, chroniclesEnemyAttackTarget, chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

const ID = 'chain-prelate';
function encounter() {
  const base = createChroniclesState('chain-basilica', null, { rules: 'mm3' });
  return {
    ...base,
    ...Object.fromEntries(chroniclesActiveEnemies(base).filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 11, y: 2, direction: 2, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 9, y: 3 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('Basilica Prelate firing-lane pursuit', () => {
  it('acquires a legal firing lane without a free shot or camera rotation', () => {
    const before = encounter();
    const foe = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(foe.ai).toMatchObject({ movement: 'hold', attackReach: 3, requiresLineOfSight: true,
      engagedMovement: 'cardinal-chase', engageRange: 3 });
    expect(chroniclesEnemyAttackTarget(before, foe)).toBeNull();
    let state = before;
    for (const x of [10, 11]) {
      state = chroniclesResolveEnemyActor(state, ID);
      expect(state.enemyTurnEvents.map(event => event.type)).toEqual(['move']);
      expect(state.enemyPositions[ID]).toEqual({ x, y: 3 });
      expect(state.party).toEqual(before.party);
      expect(state.direction).toBe(before.direction);
      expect(state.initiative).toEqual(before.initiative);
    }
    expect(chroniclesEnemyAttackTarget(state, foe)).toBeTruthy();
    const after = chroniclesResolveEnemyActor(state, ID);
    expect(after.enemyTurnEvents.map(event => event.type)).toEqual(['attack']);
    expect(after.enemyPositions).toEqual(state.enemyPositions);
    expect(after.enemyTurnEvents[0].damage).toBeLessThanOrEqual(2);
  });

  it('holds a distant post outside initiative and spends paralysis without repositioning', () => {
    const before = encounter();
    const foe = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(chroniclesChooseEnemyStep({ ...before, phase: 'explore', turnPhase: 'player',
      initiative: null, x: 1, y: 1 }, foe)).toBeNull();
    const held = { ...before, enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents.map(event => event.type)).toEqual(['paralyzed']);
    expect(after.enemyPositions).toEqual(held.enemyPositions);
    expect(after.party).toEqual(held.party);
  });
});
