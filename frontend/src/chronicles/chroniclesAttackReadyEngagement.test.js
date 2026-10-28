import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyCanAttackParty, chroniclesEnemyHasSightline, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesEngagedEnemies, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

const GOBLIN_ID = 'sewers-goblin-west';

function loneSewerGoblin() {
  const initial = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(initial);
  const goblin = enemies.find((enemy) => enemy.id === GOBLIN_ID);
  expect(goblin).toBeTruthy();
  return {
    goblin,
    state: {
      ...initial,
      ...Object.fromEntries(enemies.filter((enemy) => enemy.id !== GOBLIN_ID)
        .map((enemy) => [enemy.hpKey, 0])),
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN_ID]: { x: 1, y: 3 } },
    },
  };
}

describe('MM3 automatic combat needs a legal enemy attack', () => {
  it('allows melee pursuit at detection range without freezing the party in initiative', () => {
    const { goblin, state } = loneSewerGoblin();
    expect(goblin.ai.engageRange).toBeGreaterThan(goblin.ai.attackReach);
    expect(chroniclesEnemyHasSightline(state, { x: 1, y: 3 }, { x: 1, y: 1 })).toBe(true);
    expect(chroniclesEnemyCanAttackParty(state, goblin)).toBe(false);
    expect(chroniclesEngagedEnemies(state, [goblin])).toEqual([]);
    expect(chroniclesStartInitiativeCombat(state, [goblin], { random: () => 0 })).toBe(state);

    // A spent turn still lets the alerted goblin approach by one real cell.
    const approached = chroniclesGridExplorationStep(state, 'turn-right');
    expect(chroniclesRuntimeEnemyPosition(approached, goblin)).toEqual({ x: 1, y: 2 });
    expect(chroniclesEnemyCanAttackParty(approached, goblin)).toBe(true);
    const combat = chroniclesStartInitiativeCombat(approached, [goblin], { random: () => 0 });
    expect(combat.phase).toBe('combat');
    expect(combat.initiative.order.some((actor) => actor.id === goblin.id)).toBe(true);
  });

  it('does not confuse a visible diagonal ranged enemy with a legal straight shot', () => {
    const { goblin, state } = loneSewerGoblin();
    const shooter = { ...goblin, ai: {
      ...goblin.ai, attackReach: 3, engageRange: 4, requiresLineOfSight: true,
    } };
    const diagonal = { ...state, enemyPositions: { [GOBLIN_ID]: { x: 3, y: 2 } } };
    expect(chroniclesEnemyHasSightline(diagonal, { x: 3, y: 2 }, { x: 1, y: 1 })).toBe(true);
    expect(chroniclesEnemyCanAttackParty(diagonal, shooter)).toBe(false);
    expect(chroniclesEngagedEnemies(diagonal, [shooter])).toEqual([]);

    const firingLane = { ...state, enemyPositions: { [GOBLIN_ID]: { x: 3, y: 1 } } };
    expect(chroniclesEnemyCanAttackParty(firingLane, shooter)).toBe(true);
    expect(chroniclesEngagedEnemies(firingLane, [shooter])).toEqual([shooter]);
  });

  it('preserves a combat explicitly provoked by the party before the foe reaches melee', () => {
    const { goblin, state } = loneSewerGoblin();
    const attacked = chroniclesStartInitiativeCombat(state, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(attacked.phase).toBe('combat');
    expect(attacked.initiative.order.some((actor) => actor.id === goblin.id)).toBe(true);
  });
});
