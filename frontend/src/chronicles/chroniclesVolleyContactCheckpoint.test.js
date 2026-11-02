import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
} from './chroniclesInitiative.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const GOBLIN = 'sewers-goblin-west';
const MAP = 'swordhaven-sewers';

function nextGoblinSlot(state) {
  let current = state;
  for (let index = 0; index <= state.initiative.order.length; index += 1) {
    const actor = chroniclesCurrentInitiativeActor(current.initiative);
    if (actor?.kind === 'enemy' && actor.id === GOBLIN) return current;
    current = chroniclesAdvanceCombatInitiative(current, chroniclesActiveEnemies(current));
  }
  throw new Error('Goblin never received its next initiative slot');
}

describe('MM3 B1 · checkpoint at melee contact', () => {
  it('resumes pursuit at contact, attacks once and returns control to a hero', () => {
    const base = createChroniclesState(MAP, null, { rules: 'mm3' });
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
    let combat = chroniclesAdvanceOpeningVolley(prepared, fired);
    expect(combat.phase).toBe('combat');
    expect(fired.turns).toBe(prepared.turns + 1);

    for (const y of [3, 2]) {
      const turn = nextGoblinSlot(combat);
      const hpBefore = turn.party.map(({ hp }) => hp);
      const resolved = chroniclesRunPendingEnemyTurn(
        turn, GOBLIN, undefined, turn.initiative,
      );
      expect(resolved?.error).toBeNull();
      expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['move']);
      expect(chroniclesRuntimeEnemyPosition(resolved.committed, goblin)).toEqual({ x: 1, y });
      expect(resolved.committed.party.map(({ hp }) => hp)).toEqual(hpBefore);
      expect(resolved.committed.turns).toBe(fired.turns);
      combat = resolved.committed;
    }

    // Save at contact, not before the first pursuit step. The next enemy
    // action must be a single attack, never another move or a double attack.
    const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(combat, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState(MAP, null, { rules: 'mm3' }), checkpoint,
    );
    expect(restored.phase).toBe('combat');
    expect(restored.turns).toBe(fired.turns);
    expect(chroniclesRuntimeEnemyPosition(restored, goblin)).toEqual({ x: 1, y: 2 });

    const turn = nextGoblinSlot(restored);
    const resolved = chroniclesRunPendingEnemyTurn(
      turn, GOBLIN, undefined, turn.initiative,
    );
    expect(resolved?.error).toBeNull();
    expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(resolved.committed, goblin)).toEqual({ x: 1, y: 2 });
    expect(resolved.committed.turns).toBe(fired.turns);
    expect(chroniclesCurrentInitiativeActor(resolved.committed.initiative)?.kind).toBe('party');
    expect(chroniclesRunPendingEnemyTurn(
      resolved.committed, GOBLIN, undefined, turn.initiative,
    )).toBeNull();
  });
});
