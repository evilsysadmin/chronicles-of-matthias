import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  chroniclesTileAt,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies } from './chroniclesGridExplorationStep.js';
import { chroniclesPrecontactMeleeContact, chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';

const ARCHER = 'banner-road-east-scout';

// The real Banner Road crossbowman has a clear shot along x=10, while
// authored masonry at (9,4) separates the same two rows along x=9.
function armedLane(x) {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const archer = enemies.find(({ id }) => id === ARCHER);
  expect(archer?.ai).toMatchObject({ attackReach: 3, requiresLineOfSight: true });
  const inactive = Object.fromEntries(enemies
    .filter(({ id }) => id !== ARCHER).map(({ hpKey }) => [hpKey, 0]));
  const state = {
    ...base, ...inactive, [archer.hpKey]: 100,
    x, y: 3, direction: 2,
    enemyPositions: { [ARCHER]: { x, y: 5 } },
    equipment: {
      ...base.equipment,
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
    },
  };
  expect(chroniclesTileAt(x, 3, state)).toBe('.');
  expect(chroniclesTileAt(x, 5, state)).toBe('.');
  return { state, archer };
}

describe('MM3 B1 · opening volley against a real ranged enemy', () => {
  it('charges one volley, stays mobile and gives the crossbowman exactly one exploration response', () => {
    const { state, archer } = armedLane(10);
    expect(chroniclesPrecontactMeleeContact(state)).toBe(false);
    const opening = chroniclesOpeningVolleyShots(state);
    expect(opening.target?.id).toBe(ARCHER);
    expect(opening.shots).toHaveLength(1);

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    expect(fired[archer.hpKey]).toBeGreaterThan(0);
    const afterVolley = chroniclesAdvanceOpeningVolley(state, fired);
    expect(afterVolley.phase).toBe('explore');
    expect(afterVolley.initiative).toBeFalsy();
    expect(afterVolley.enemyTurnEvents || []).toEqual([]);

    const reply = chroniclesAdvanceExplorationEnemies(state, afterVolley);
    expect(reply.phase).toBe('explore');
    expect(reply.initiative).toBeFalsy();
    expect(reply.turns).toBe(fired.turns);
    expect(reply.enemyTurnEvents.map(({ type }) => type)).toEqual(['attack']);
    expect(chroniclesEnemyAttackTarget(reply, archer)).toBeTruthy();
    expect(chroniclesRuntimeEnemyPosition(reply, archer)).toEqual({ x: 10, y: 5 });
    expect(chroniclesAdvanceExplorationEnemies(reply, reply)).toBe(reply);
    // The party can still turn or move despite the incoming ranged attack.
    expect(chroniclesReduce(reply, 'turn-right').direction).not.toBe(reply.direction);
  });

  it('does not provoke phantom initiative or retaliation through authored masonry', () => {
    const { state, archer } = armedLane(9);
    expect(chroniclesTileAt(9, 4, state)).toBe('#');
    expect(chroniclesOpeningVolleyShots(state).target).toBeNull();
    expect(chroniclesEnemyAttackTarget(state, archer)).toBeNull();

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    const after = chroniclesAdvanceOpeningVolley(state, fired);
    expect(after.phase).toBe('explore');
    expect(after.initiative).toBeFalsy();
    expect(after.party).toEqual(state.party);
    expect(after[archer.hpKey]).toBe(100);
  });
});
