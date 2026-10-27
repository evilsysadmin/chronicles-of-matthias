import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const MAP_ID = 'swordhaven-sewers';
const WEST_PACK = ['sewers-goblin-west', 'sewers-goblin-overflow', 'sewers-goblin-bottom-shaft'];

describe('Chronicles · sewer ambush checkpoint continuity', () => {
  it('restores all three goblins with exactly one initiative slot and turn per living actor', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const atEntrance = { ...base, x: 1, y: 5 };
    const enemies = chroniclesActiveEnemies(atEntrance)
      .filter((enemy) => WEST_PACK.includes(enemy.id));
    expect(enemies).toHaveLength(3);

    const combat = chroniclesStartInitiativeCombat(atEntrance, enemies, { random: () => 0 });
    expect(combat.phase).toBe('combat');
    expect(combat.initiative.order.filter((actor) => actor.kind === 'enemy')
      .map((actor) => actor.id).sort()).toEqual([...WEST_PACK].sort());

    // Exercise the real API checkpoint projection and recovery, not a direct
    // clone of the in-memory initiative object.
    const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(combat, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState(MAP_ID, null, { rules: 'mm3' }),
      {
        worldFlags: checkpoint.worldFlags,
        consumedContentIds: checkpoint.consumedContentIds,
        claimedRewards: checkpoint.claimedRewards,
      },
    );
    expect(restored.phase).toBe('combat');
    expect(restored.initiative).toEqual(combat.initiative);
    for (const enemy of enemies) {
      expect(restored[enemy.hpKey]).toBe(combat[enemy.hpKey]);
    }

    const originalOrder = combat.initiative.order.map((actor) => `${actor.kind}:${actor.id}`);
    expect(new Set(originalOrder).size).toBe(originalOrder.length);
    let current = restored;
    const acted = [];
    for (let turn = 0; turn < originalOrder.length; turn += 1) {
      const actor = chroniclesCurrentInitiativeActor(current.initiative);
      acted.push(`${actor.kind}:${actor.id}`);
      current = chroniclesAdvanceCombatInitiative(current, enemies);
      expect(current.phase).toBe('combat');
    }

    // No lost turn, duplicate turn or extra round after F5: the next actor
    // is the first one again, and the round counter advances exactly once.
    expect(acted).toEqual(originalOrder);
    expect(current.initiative.round).toBe(combat.initiative.round + 1);
    expect(chroniclesCurrentInitiativeActor(current.initiative)).toEqual(combat.initiative.order[0]);
  });
});
