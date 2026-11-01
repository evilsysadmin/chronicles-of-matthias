import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  chroniclesTileAt,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
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
  it('charges one volley, starts initiative, then allows exactly one crossbow response', () => {
    const { state, archer } = armedLane(10);
    expect(chroniclesTileAt(10, 4, state)).toBe('.');
    expect(chroniclesPrecontactMeleeContact(state)).toBe(false);
    const opening = chroniclesOpeningVolleyShots(state);
    expect(opening.target?.id).toBe(ARCHER);
    expect(opening.shots).toHaveLength(1);

    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);
    expect(fired[archer.hpKey]).toBeGreaterThan(0);
    const engaged = chroniclesAdvanceOpeningVolley(state, fired);
    expect(engaged.phase).toBe('combat');
    expect(engaged.turns).toBe(fired.turns);
    expect(engaged.party.map(({ hp }) => hp)).toEqual(state.party.map(({ hp }) => hp));
    expect(engaged.enemyTurnEvents || []).toEqual([]);
    expect(chroniclesRuntimeEnemyPosition(engaged, archer)).toEqual({ x: 10, y: 5 });

    const enemyCursor = engaged.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === ARCHER,
    );
    expect(enemyCursor).toBeGreaterThanOrEqual(0);
    const enemyTurn = {
      ...engaged,
      initiative: { ...engaged.initiative, cursor: enemyCursor },
    };
    expect(chroniclesEnemyAttackTarget(enemyTurn, archer)).toBeTruthy();
    const resolved = chroniclesRunPendingEnemyTurn(enemyTurn, ARCHER);
    expect(resolved?.error).toBeNull();
    expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['attack']);
    expect(resolved.committed.turns).toBe(fired.turns);
    expect(chroniclesRuntimeEnemyPosition(resolved.committed, archer)).toEqual({ x: 10, y: 5 });

    // A delayed browser callback for the spent slot cannot fire a second bolt.
    expect(chroniclesRunPendingEnemyTurn(
      resolved.committed, ARCHER, undefined, enemyTurn.initiative,
    )).toBeNull();
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
