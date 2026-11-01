import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesAdvanceExplorationEnemies } from './chroniclesGridExplorationStep.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';

const GOBLIN_ID = 'sewers-goblin-west';

function distantGoblin() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const goblin = enemies.find(({ id }) => id === GOBLIN_ID);
  expect(goblin).toBeTruthy();
  const state = {
    ...base,
    ...Object.fromEntries(enemies
      .filter(({ id }) => id !== GOBLIN_ID)
      .map(({ hpKey }) => [hpKey, 0])),
    [goblin.hpKey]: 100,
    x: 1, y: 1, direction: 2,
    enemyPositions: { [GOBLIN_ID]: { x: 1, y: 4 } },
    equipment: {
      ...base.equipment,
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
    },
  };
  return { state, goblin };
}

describe('MM3 B1 · exploration-to-initiative enemy action handoff', () => {
  it('does not give the goblin a free exploration step before its first initiative action', () => {
    const { state, goblin } = distantGoblin();
    const fired = chroniclesReduce(state, 'volley');
    expect(fired.turns).toBe(state.turns + 1);

    const engaged = chroniclesAdvanceOpeningVolley(state, fired);
    expect(engaged.phase).toBe('combat');
    expect(engaged.initiative).toBeTruthy();
    expect(chroniclesRuntimeEnemyPosition(engaged, goblin)).toEqual({ x: 1, y: 4 });

    // The same spent S must not run the exploration AI after initiative starts.
    const handedOff = chroniclesAdvanceExplorationEnemies(state, engaged);
    expect(handedOff).toBe(engaged);
    expect(handedOff.turns).toBe(fired.turns);
    expect(handedOff.explorationEnemySteps).toBe(state.explorationEnemySteps);
    expect(handedOff.party.map(({ hp }) => hp)).toEqual(state.party.map(({ hp }) => hp));

    const cursor = handedOff.initiative.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === GOBLIN_ID,
    );
    expect(cursor).toBeGreaterThanOrEqual(0);
    const enemyTurn = {
      ...handedOff,
      initiative: { ...handedOff.initiative, cursor },
    };
    const resolved = chroniclesRunPendingEnemyTurn(
      enemyTurn, GOBLIN_ID, undefined, enemyTurn.initiative,
    );
    expect(resolved?.error).toBeNull();
    expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(resolved.committed, goblin))
      .toEqual({ x: 1, y: 3 });
    expect(resolved.committed.turns).toBe(fired.turns);
    expect(resolved.committed.party.map(({ hp }) => hp))
      .toEqual(state.party.map(({ hp }) => hp));

    // A delayed callback for the consumed slot must not move twice.
    expect(chroniclesRunPendingEnemyTurn(
      resolved.committed, GOBLIN_ID, undefined, enemyTurn.initiative,
    )).toBeNull();
  });

  it('leaves both AI schedulers inert when a stale volley did not spend a turn', () => {
    const { state, goblin } = distantGoblin();
    const refused = chroniclesAdvanceOpeningVolley(state, state);
    expect(refused).toBe(state);
    expect(chroniclesAdvanceExplorationEnemies(state, refused)).toBe(state);
    expect(chroniclesRuntimeEnemyPosition(refused, goblin)).toEqual({ x: 1, y: 4 });
  });
});
