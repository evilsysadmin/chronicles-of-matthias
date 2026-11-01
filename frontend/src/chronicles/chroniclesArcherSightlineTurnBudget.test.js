import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesTileAt,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesEnemyAttackTarget,
  chroniclesResolveEnemyActor,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';

const ARCHER_ID = 'banner-road-east-scout';

// The authored Banner Road wall has masonry at (9, 4), but a clear
// passage at (10, 4). Both lanes put the real crossbowman two tiles
// from the company, within his configured three-cell attack reach.
function crossbowLane(x) {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const archer = enemies.find((enemy) => enemy.id === ARCHER_ID);
  expect(archer?.ai).toMatchObject({ attackReach: 3, requiresLineOfSight: true });
  const inactive = Object.fromEntries(enemies
    .filter((enemy) => enemy.id !== ARCHER_ID)
    .map((enemy) => [enemy.hpKey, 0]));
  return {
    archer,
    state: {
      ...base,
      ...inactive,
      x, y: 3, direction: 2,
      phase: 'combat', turnPhase: 'enemy',
      enemyPositions: { [ARCHER_ID]: { x, y: 5 } },
      initiative: {
        round: 1, cursor: 0,
        order: [{ kind: 'enemy', id: ARCHER_ID }],
      },
    },
  };
}

describe('MM3 crossbowman sightline and initiative action budget', () => {
  it('cannot shoot through authored masonry or deal damage while holding position', () => {
    const { state, archer } = crossbowLane(9);
    expect(chroniclesTileAt(9, 4, state)).toBe('#');
    expect(chroniclesEnemyAttackTarget(state, archer)).toBeNull();

    const next = chroniclesResolveEnemyActor(state, ARCHER_ID);
    expect(next.enemyTurnEvents).toEqual([]);
    expect(chroniclesRuntimeEnemyPosition(next, archer)).toEqual({ x: 9, y: 5 });
    expect(next.party.map((hero) => hero.hp)).toEqual(state.party.map((hero) => hero.hp));
    expect(next.turns).toBe(state.turns);
  });

  it('fires one attack from a clear lane without moving or spending an extra exploration turn', () => {
    const { state, archer } = crossbowLane(10);
    expect(chroniclesTileAt(10, 4, state)).toBe('.');
    expect(chroniclesEnemyAttackTarget(state, archer)).toBeTruthy();

    const next = chroniclesResolveEnemyActor(state, ARCHER_ID);
    expect(next.enemyTurnEvents.map((event) => event.type)).toEqual(['attack']);
    expect(next.enemyTurnEvents[0].enemyId).toBe(ARCHER_ID);
    expect(chroniclesRuntimeEnemyPosition(next, archer)).toEqual({ x: 10, y: 5 });
    expect(next.turns).toBe(state.turns);
  });
});
