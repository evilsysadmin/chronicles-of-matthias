import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesChooseEnemyStep, chroniclesEnemyAttackTarget, chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

const ID = 'ember-artificer';
function encounter() {
  const base = createChroniclesState('iron-foundry', null, { rules: 'mm3' });
  return {
    ...base,
    ...Object.fromEntries(chroniclesActiveEnemies(base).filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 7, y: 5, direction: 0, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 9, y: 3 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('Foundry Artificer firing-lane pursuit', () => {
  it('uses cardinal movement to acquire a legal shot and fires only on a later action', () => {
    const before = encounter();
    const caster = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(caster.ai).toMatchObject({ movement: 'hold', attackReach: 3, requiresLineOfSight: true,
      disengageRange: 1, engagedMovement: 'cardinal-chase', engageRange: 3 });
    expect(chroniclesEnemyAttackTarget(before, caster)).toBeNull();
    let current = before;
    for (let step = 0; step < 2; step++) {
      const prior = current.enemyPositions[ID];
      current = chroniclesResolveEnemyActor(current, ID);
      const pos = current.enemyPositions[ID];
      expect(current.enemyTurnEvents.map(event => event.type)).toEqual(['move']);
      expect(Math.abs(pos.x - prior.x) + Math.abs(pos.y - prior.y)).toBe(1);
      expect(current.party).toEqual(before.party);
      expect(current.direction).toBe(before.direction);
      expect(current.initiative).toEqual(before.initiative);
    }
    expect(chroniclesEnemyAttackTarget(current, caster)).toBeTruthy();
    const fired = chroniclesResolveEnemyActor(current, ID);
    expect(fired.enemyTurnEvents.map(event => event.type)).toEqual(['attack']);
    expect(fired.enemyPositions).toEqual(current.enemyPositions);
    expect(fired.enemyTurnEvents[0].damage).toBeLessThanOrEqual(1);
  });

  it('retains its distant exploration post and cannot move while paralysed', () => {
    const before = encounter();
    const caster = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(chroniclesChooseEnemyStep({ ...before, x: 1, y: 1, phase: 'explore', turnPhase: 'player',
      initiative: null }, caster)).toBeNull();
    const held = { ...before, enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents).toEqual([{ type: 'paralyzed', enemyId: ID, left: 0 }]);
    expect(after.enemyPositions).toEqual(held.enemyPositions);
    expect(after.party).toEqual(held.party);
  });
});
