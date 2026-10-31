import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

describe('MM3 BLOCK · one action per initiative slot', () => {
  it('rejects duplicate dispatches, including after a checkpoint, and permits the next round', () => {
    const initial = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(initial).find(({ id }) => id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    const prepared = {
      ...initial,
      ...Object.fromEntries(chroniclesActiveEnemies(initial)
        .filter(({ id }) => id !== goblin.id).map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [goblin.id]: { x: 1, y: 2 } },
    };
    const started = chroniclesStartInitiativeCombat(prepared, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(started.phase).toBe('combat');
    const cursor = started.initiative.order.findIndex(
      ({ kind, id }) => kind === 'party' && id === 'bishop',
    );
    expect(cursor).toBeGreaterThanOrEqual(0);
    const bishopTurn = { ...started, initiative: { ...started.initiative, cursor } };
    const action = { type: 'block', memberId: 'bishop' };

    const guarded = chroniclesReduce(bishopTurn, action);
    expect(guarded.turns).toBe(bishopTurn.turns + 1);
    expect(guarded.combatBlock?.bishop).toBe(true);
    expect(chroniclesReduce(guarded, action)).toBe(guarded);
    expect(chroniclesReduce(guarded, { type: 'block', memberId: 'rook' })).toBe(guarded);

    // Save/resume must not turn the same initiative slot into a second action.
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(guarded, 1)));
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), payload,
    );
    expect(resumed.phase).toBe('combat');
    expect(chroniclesCurrentInitiativeActor(resumed.initiative)?.id).toBe('bishop');
    expect(resumed.combatBlock?.bishop).toBe(true);
    expect(chroniclesReduce(resumed, action)).toBe(resumed);

    // BLOCK expires when this hero's NEXT initiative slot begins.
    let next = resumed;
    let passedOtherActor = false;
    for (let step = 0; step < resumed.initiative.order.length; step += 1) {
      next = chroniclesAdvanceCombatInitiative(next, chroniclesActiveEnemies(next));
      expect(next.phase).toBe('combat');
      const actor = chroniclesCurrentInitiativeActor(next.initiative);
      if (actor?.kind === 'party' && actor.id === 'bishop') break;
      passedOtherActor = true;
      expect(next.combatBlock?.bishop).toBe(true);
    }
    expect(passedOtherActor).toBe(true);
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('bishop');
    expect(next.combatBlock?.bishop).toBeUndefined();
    const nextRound = chroniclesReduce(next, action);
    expect(nextRound.turns).toBe(next.turns + 1);
    expect(nextRound.combatBlock?.bishop).toBe(true);
  });
});
