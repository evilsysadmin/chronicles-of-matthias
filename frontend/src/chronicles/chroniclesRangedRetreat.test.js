import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyDisengageStep,
  chroniclesEnemyAttackTarget,
  chroniclesResolveEnemyActor,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';

const ARCHER = 'banner-road-east-scout';
const BLOCKER = 'banner-road-deserter';

function adjacentArcherFight(blockFiringLane = false) {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const archer = enemies.find((enemy) => enemy.id === ARCHER);
  const blocker = enemies.find((enemy) => enemy.id === BLOCKER);
  expect(archer?.ai).toMatchObject({
    attackReach: 3, requiresLineOfSight: true, disengageRange: 1,
  });
  expect(blocker).toBeTruthy();
  const inactive = Object.fromEntries(enemies
    .filter((enemy) => enemy.id !== ARCHER && (!blockFiringLane || enemy.id !== BLOCKER))
    .map((enemy) => [enemy.hpKey, 0]));
  const state = {
    ...base,
    ...inactive,
    x: 10, y: 7,
    phase: 'combat',
    enemyPositions: {
      [ARCHER]: { x: 10, y: 8 },
      ...(blockFiringLane ? { [BLOCKER]: { x: 10, y: 9 } } : {}),
    },
    initiative: {
      round: 1, cursor: 0, order: [{ kind: 'enemy', id: ARCHER }],
    },
  };
  expect(chroniclesEnemyAttackTarget(state, archer)).toBeTruthy();
  return { state, archer };
}

describe('MM3 ranged enemy retreat preserves a real firing lane', () => {
  it('backs straight away instead of sidestepping into a diagonal with no shot', () => {
    const { state, archer } = adjacentArcherFight();
    // East is the first legal equally distant retreat in the old tie order,
    // but a diagonal from (11,8) cannot shoot the company at (10,7).
    expect(chroniclesEnemyAttackTarget(state, archer, { x: 11, y: 8 })).toBeNull();
    expect(chroniclesEnemyAttackTarget(state, archer, { x: 10, y: 9 })).toBeTruthy();
    expect(chroniclesChooseEnemyDisengageStep(state, archer)).toMatchObject({ x: 10, y: 9 });

    const retreated = chroniclesResolveEnemyActor(state, ARCHER);
    expect(retreated.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(retreated, archer)).toEqual({ x: 10, y: 9 });
    expect(retreated.party.map((member) => member.hp)).toEqual(state.party.map((member) => member.hp));

    // Moving costs the whole action; only the next action may fire.
    const shot = chroniclesResolveEnemyActor(retreated, ARCHER);
    expect(shot.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
  });

  it('fires from its current cell if the only straight retreat is occupied', () => {
    const { state, archer } = adjacentArcherFight(true);
    expect(chroniclesChooseEnemyDisengageStep(state, archer)).toBeNull();
    const shot = chroniclesResolveEnemyActor(state, ARCHER);
    expect(shot.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(shot, archer)).toEqual({ x: 10, y: 8 });
  });
});
