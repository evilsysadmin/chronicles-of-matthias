import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep, chroniclesEnemyAttackTarget,
  chroniclesResolveEnemyActor,
} from '../chroniclesOfMatthiasTurns.js';

const ID = 'blind-archivist';
function encounter() {
  const base = createChroniclesState('blind-king-archive', null, { rules: 'mm3' });
  const foes = chroniclesActiveEnemies(base);
  return {
    ...base,
    ...Object.fromEntries(foes.filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 7, y: 3, direction: 1, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 8, y: 2 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('Blind Archivist firing-lane tactics', () => {
  it('spends one action acquiring a legal lane, then fires on the next action', () => {
    const before = encounter();
    const caster = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(caster.ai).toMatchObject({ movement: 'hold', attackReach: 2, requiresLineOfSight: true,
      engagedMovement: 'cardinal-chase', engageRange: 2 });
    expect(chroniclesEnemyAttackTarget(before, caster)).toBeNull();
    const moved = chroniclesResolveEnemyActor(before, ID);
    expect(moved.enemyTurnEvents).toEqual([
      { type: 'move', enemyId: ID, from: { x: 8, y: 2 }, to: { x: 8, y: 3 } },
    ]);
    expect(moved.party).toEqual(before.party);
    expect(moved.direction).toBe(before.direction);
    expect(moved.initiative).toEqual(before.initiative);
    expect(chroniclesEnemyAttackTarget(moved, caster)).toBeTruthy();
    const fired = chroniclesResolveEnemyActor(moved, ID);
    expect(fired.enemyTurnEvents.map(event => event.type)).toEqual(['attack']);
    expect(fired.enemyPositions).toEqual(moved.enemyPositions);
    expect(fired.enemyTurnEvents[0].damage).toBeLessThanOrEqual(2);
  });

  it('holds its distant post outside initiative and cannot reposition while paralysed', () => {
    const before = encounter();
    const caster = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(chroniclesChooseEnemyStep({
      ...before, phase: 'explore', turnPhase: 'player', initiative: null, x: 1, y: 7,
    }, caster)).toBeNull();
    const held = { ...before, enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents.map(event => event.type)).toEqual(['paralyzed']);
    expect(after.enemyPositions).toEqual(held.enemyPositions);
    expect(after.party).toEqual(held.party);
  });
});
