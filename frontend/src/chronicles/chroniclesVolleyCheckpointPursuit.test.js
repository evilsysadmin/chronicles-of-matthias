import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const GOBLIN = 'sewers-goblin-west';
const saveAndRestore = (state) => chroniclesApplyRunCheckpoint(
  createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }),
  JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 1))),
);

describe('MM3 B1 · opening volley survives a checkpoint before the enemy acts', () => {
  it('resumes the same pursuit tile and spends only the pending enemy slot', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const goblin = enemies.find(({ id }) => id === GOBLIN);
    expect(goblin).toBeTruthy();

    const prepared = {
      ...base,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN)
        .map(({ hpKey }) => [hpKey, 0])),
      [goblin.hpKey]: 100,
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN]: { x: 1, y: 4 } },
      equipment: {
        matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      },
    };
    expect(chroniclesOpeningVolleyShots(prepared).target?.id).toBe(GOBLIN);

    const fired = chroniclesReduce(prepared, 'volley');
    expect(fired.turns).toBe(prepared.turns + 1);
    const engaged = chroniclesAdvanceOpeningVolley(prepared, fired);
    const enemyCursor = engaged.initiative?.order.findIndex(
      ({ kind, id }) => kind === 'enemy' && id === GOBLIN,
    );
    expect(enemyCursor).toBeGreaterThanOrEqual(0);
    const pending = {
      ...engaged,
      initiative: { ...engaged.initiative, cursor: enemyCursor },
    };
    const restored = saveAndRestore(pending);
    expect(restored.phase).toBe('combat');
    expect(restored.turns).toBe(fired.turns);
    expect(restored.initiative?.order[restored.initiative.cursor])
      .toMatchObject({ kind: 'enemy', id: GOBLIN });
    expect(chroniclesRuntimeEnemyPosition(restored, goblin)).toEqual({ x: 1, y: 4 });

    const hpBefore = restored.party.map(({ hp }) => hp);
    const result = chroniclesRunPendingEnemyTurn(
      restored, GOBLIN, undefined, restored.initiative,
    );
    expect(result?.error).toBeNull();
    expect(result.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(result.committed, goblin))
      .toEqual({ x: 1, y: 3 });
    expect(result.committed.party.map(({ hp }) => hp)).toEqual(hpBefore);
    expect(result.committed.turns).toBe(restored.turns);

    // A delayed callback from before the committed action cannot move again.
    expect(chroniclesRunPendingEnemyTurn(
      result.committed, GOBLIN, undefined, restored.initiative,
    )).toBeNull();
    const resumed = saveAndRestore(result.committed);
    expect(chroniclesRuntimeEnemyPosition(resumed, goblin)).toEqual({ x: 1, y: 3 });
    expect(resumed.party.map(({ hp }) => hp)).toEqual(hpBefore);
    expect(resumed.turns).toBe(restored.turns);
  });
});
