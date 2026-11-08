import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesOpeningVolleyShots, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesAdvanceCombatInitiative, chroniclesCurrentInitiativeActor, chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesAdvanceExplorationEnemies, chroniclesGridExplorationStep } from './chroniclesGridExplorationStep.js';
import { chroniclesAdvanceOpeningVolley } from './chroniclesPrecontactVolley.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

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

describe('MM3 · first melee contact after a ranged volley survives F5', () => {
  it('moves in exploration, checkpoints contact, then attacks once in initiative', () => {
    const base = createChroniclesState(MAP, null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(base);
    const goblin = enemies.find(({ id }) => id === GOBLIN);
    const prepared = {
      ...base,
      ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN).map(({ hpKey }) => [hpKey, 0])),
      [goblin.hpKey]: 100,
      x: 1, y: 1, direction: 2,
      enemyPositions: { [GOBLIN]: { x: 1, y: 4 } },
      equipment: { matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } },
    };
    expect(chroniclesOpeningVolleyShots(prepared).target?.id).toBe(GOBLIN);
    const fired = chroniclesAdvanceOpeningVolley(prepared, chroniclesReduce(prepared, 'volley'));
    expect(fired.phase).toBe('explore');
    const pursued = chroniclesAdvanceExplorationEnemies(prepared, fired);
    expect(chroniclesRuntimeEnemyPosition(pursued, goblin)).toEqual({ x: 1, y: 3 });
    const contactState = chroniclesGridExplorationStep(pursued, 'turn-right');
    expect(chroniclesRuntimeEnemyPosition(contactState, goblin)).toEqual({ x: 1, y: 2 });
    const combat = chroniclesStartInitiativeCombat(contactState, [goblin], { random: () => 0 });
    expect(combat.phase).toBe('combat');
    expect(combat.turns).toBe(contactState.turns);

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(combat, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState(MAP, null, { rules: 'mm3' }), payload,
    );
    expect(restored.phase).toBe('combat');
    expect(restored.initiative).toBeTruthy();
    expect(chroniclesRuntimeEnemyPosition(restored, goblin)).toEqual({ x: 1, y: 2 });

    const turn = nextGoblinSlot(restored);
    const resolved = chroniclesRunPendingEnemyTurn(turn, GOBLIN, undefined, turn.initiative);
    expect(resolved?.error).toBeNull();
    expect(resolved.acted.enemyTurnEvents.map(({ type }) => type)).toEqual(['attack']);
    expect(chroniclesRuntimeEnemyPosition(resolved.committed, goblin)).toEqual({ x: 1, y: 2 });
    expect(resolved.committed.turns).toBe(combat.turns);
    expect(chroniclesRunPendingEnemyTurn(
      resolved.committed, GOBLIN, undefined, turn.initiative,
    )).toBeNull();
  });
});
