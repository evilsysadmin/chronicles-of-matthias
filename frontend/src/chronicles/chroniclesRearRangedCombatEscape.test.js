import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget,
  chroniclesCombatPartyStepBlocked, chroniclesReduce, createChroniclesState,
  chroniclesTileAt,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesEnemyAttackTarget, chroniclesEnemyAttackReach,
} from '../chroniclesOfMatthiasTurns.js';
import {
  chroniclesAdvanceCombatInitiative, chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesAdvanceExplorationEnemies } from './chroniclesGridExplorationStep.js';

const ARCHER_ID = 'banner-road-east-scout';
const MELEE_ID = 'banner-road-deserter';

function encounter(enemyId, { x = 10, y = 3, direction = 2, enemyX = 10, enemyY = 5 } = {}) {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const enemy = all.find((candidate) => candidate.id === enemyId);
  expect(enemy).toBeTruthy();
  const others = Object.fromEntries(all.filter((candidate) => candidate.id !== enemyId)
    .map((candidate) => [candidate.hpKey, 0]));
  const state = {
    ...base, ...others, x, y, direction,
    enemyPositions: { [enemyId]: { x: enemyX, y: enemyY } },
  };
  expect(chroniclesTileAt(x, y, state)).toBe('.');
  expect(chroniclesTileAt(enemyX, enemyY, state)).toBe('.');
  return { state, enemy };
}

describe('MM3: stationary melee and mobile ranged exploration', () => {
  it('does not start initiative from a live rear archer two cells away, even when forced', () => {
    const { state, enemy } = encounter(ARCHER_ID);
    expect(chroniclesEnemyAttackReach(enemy)).toBe(3);
    expect(chroniclesEnemyAttackTarget(state, enemy)).toBeTruthy();
    expect(chroniclesStartInitiativeCombat(state, [enemy], {
      forceEnemyIds: [enemy.id], random: () => 0,
    })).toBe(state);

    const shot = chroniclesAdvanceExplorationEnemies(state, { ...state, turns: state.turns + 1 });
    expect(shot.phase).toBe('explore');
    expect(shot.initiative).toBeFalsy();
    expect(shot.enemyTurnEvents).toEqual([expect.objectContaining({
      type: 'attack', enemyId: enemy.id,
    })]);
    expect([shot.x, shot.y, shot.direction]).toEqual([10, 3, 2]);
  });

  it('lets players move under ranged fire; adjacent archers alone do not force initiative', () => {
    const { state, enemy } = encounter(ARCHER_ID);
    const moved = chroniclesReduce(state, 'forward');
    expect([moved.x, moved.y, moved.direction]).toEqual([10, 4, 2]);
    expect(chroniclesStartInitiativeCombat(moved, [enemy], {
      forceEnemyIds: [enemy.id],
    })).toBe(moved);
    expect(moved.phase).toBe('explore');
    expect(chroniclesCombatPartyStepBlocked(moved, 'backward')).toBe(false);
  });

  it('faces an actual melee attacker once, then forbids all movement and turns', () => {
    const { state, enemy } = encounter(MELEE_ID, { direction: 2, enemyY: 2 });
    const started = chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 });
    expect(started.phase).toBe('combat');
    expect(started.direction).toBe(0); // Attacker north; explorer was facing south.
    expect(chroniclesCombatMeleeTarget(started)?.enemy.id).toBe(enemy.id);
    const index = started.initiative.order.findIndex((actor) => actor.kind === 'party');
    const hero = { ...started, initiative: { ...started.initiative, cursor: index } };
    for (const action of ['forward', 'backward', 'strafe-left', 'strafe-right', 'turn-left', 'turn-right']) {
      expect(chroniclesReduce(hero, action)).toBe(hero);
    }
    expect([hero.x, hero.y, hero.direction]).toEqual([10, 3, 0]);
  });

  it('ends restored melee initiative when no enemy can still strike and restores mobility', () => {
    const { state, enemy } = encounter(MELEE_ID, { enemyY: 2, direction: 2 });
    const engaged = chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 });
    const retreated = {
      ...engaged, enemyPositions: { [enemy.id]: { x: 10, y: 1 } },
    };
    const ended = chroniclesAdvanceCombatInitiative(retreated, [enemy]);
    expect(ended.phase).toBe('explore');
    expect(ended.initiative).toBeNull();
    expect(chroniclesCombatPartyStepBlocked(ended, 'forward')).toBe(false);
    expect(ended.direction).toBe(0);
  });
});
