import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesMM3MeleeAvailable,
  chroniclesReduce,
  createChroniclesState,
  chroniclesTileAt,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesCombatCameraFacing } from './chroniclesCombatCameraFacing.js';
import { chroniclesRunPendingEnemyTurn } from './chroniclesEnemyInitiativeTurn.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

const MAP = 'banner-road-first-book';
const MARAUDER = 'banner-road-north-marauder';

function roadsideContact(position) {
  const initial = createChroniclesState(MAP, null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(initial);
  const attacker = enemies.find((enemy) => enemy.id === MARAUDER);
  expect(attacker?.name).toBe('salteador de la calzada');
  expect(chroniclesTileAt(position.x, position.y, initial)).not.toBe('#');
  const prepared = {
    ...initial,
    ...Object.fromEntries(enemies.filter((enemy) => enemy.id !== MARAUDER)
      .map((enemy) => [enemy.hpKey, 0])),
    x: 5, y: 2, direction: 0, phase: 'explore',
    enemyPositions: { [MARAUDER]: position },
  };
  const combat = chroniclesStartInitiativeCombat(prepared, [attacker], { random: () => 0 });
  expect(combat.phase).toBe('combat');
  return { combat, attacker };
}

// Go/Mongo checkpoint payloads are JSON. Round-trip that representation so
// the test exercises the same durable flags as F5, not a shallow React copy.
function saveAndRestore(state) {
  const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 7)));
  return {
    payload,
    restored: chroniclesApplyRunCheckpoint(
      createChroniclesState(MAP, null, { rules: 'mm3' }), payload,
    ),
  };
}

describe('MM3 Banner Road: saved cardinal contact stays attackable after F5', () => {
  it.each([
    ['north', { x: 5, y: 1 }, 0],
    ['east', { x: 6, y: 2 }, 1],
    ['rear/south', { x: 5, y: 3 }, 2],
    ['west', { x: 4, y: 2 }, 3],
  ])('recovers %s contact for both the hero and enemy turns', (_side, position, facing) => {
    const { combat, attacker } = roadsideContact(position);
    expect(combat.direction).toBe(facing);
    const knightCursor = combat.initiative.order.findIndex((actor) =>
      actor.kind === 'party' && actor.id === 'knight');
    const enemyCursor = combat.initiative.order.findIndex((actor) =>
      actor.kind === 'enemy' && actor.id === MARAUDER);
    expect(knightCursor).toBeGreaterThanOrEqual(0);
    expect(enemyCursor).toBeGreaterThanOrEqual(0);

    // F5 in the hero's turn may not steal his action or swivel the camera.
    const heroTurn = { ...combat, initiative: { ...combat.initiative, cursor: knightCursor } };
    const { payload, restored } = saveAndRestore(heroTurn);
    expect(payload.currentMapId).toBe(MAP);
    expect(restored.phase).toBe('combat');
    expect(restored.direction).toBe(facing);
    expect(chroniclesCombatCameraFacing(restored)).toBe(facing);
    expect(restored.x).toBe(5);
    expect(restored.y).toBe(2);
    expect(restored.enemyPositions[MARAUDER]).toEqual(position);
    expect(restored[attacker.hpKey]).toBe(heroTurn[attacker.hpKey]);
    expect(restored.initiative.round).toBe(heroTurn.initiative.round);
    expect(chroniclesCurrentInitiativeActor(restored.initiative)).toMatchObject({
      kind: 'party', id: 'knight',
    });
    expect(chroniclesCombatMeleeTarget(restored)?.enemy.id).toBe(MARAUDER);
    expect(chroniclesMM3MeleeAvailable(restored, 'knight')).toBe(true);
    for (const turn of ['turn-left', 'turn-right']) {
      expect(chroniclesReduce(restored, turn)).toBe(restored);
    }
    const attacked = chroniclesReduce(restored, {
      type: 'attack', memberId: 'knight', mode: 'melee',
    });
    expect(attacked.turns).toBe(restored.turns + 1);
    expect(attacked.direction).toBe(facing);

    // F5 in the enemy's turn must resume its exact slot, producing a
    // legitimate adjacent strike rather than a bogus wait/movement/rotation.
    const enemyTurn = { ...combat, initiative: { ...combat.initiative, cursor: enemyCursor } };
    const { restored: enemyRestored } = saveAndRestore(enemyTurn);
    expect(enemyRestored.phase).toBe('combat');
    expect(enemyRestored.direction).toBe(facing);
    expect(chroniclesCurrentInitiativeActor(enemyRestored.initiative)).toMatchObject({
      kind: 'enemy', id: MARAUDER,
    });
    expect(chroniclesCombatMeleeTarget(enemyRestored)?.enemy.id).toBe(MARAUDER);
    const outcome = chroniclesRunPendingEnemyTurn(
      enemyRestored, MARAUDER, undefined, enemyRestored.initiative,
    );
    expect(outcome).not.toBeNull();
    expect(outcome.error).toBeNull();
    expect(outcome.acted.enemyTurnEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'attack', enemyId: MARAUDER }),
    ]));
    expect(outcome.acted.enemyTurnEvents.some(event => event.type === 'move')).toBe(false);
    expect(outcome.committed.direction).toBe(facing);
    expect(chroniclesCurrentInitiativeActor(outcome.committed.initiative)?.kind).toBe('party');
  });
});
