import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesEnemyPosition,
  chroniclesTileAt,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesCombatCameraFacing } from './chroniclesCombatCameraFacing.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const GOBLIN_ID = 'sewers-goblin-west';
const MARAUDER_ID = 'banner-road-north-marauder';

function rearContact() {
  const initial = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const goblin = chroniclesActiveEnemies(initial).find((enemy) => enemy.id === GOBLIN_ID);
  expect(goblin).toBeTruthy();
  const defeatedOthers = Object.fromEntries(
    chroniclesActiveEnemies(initial)
      .filter((enemy) => enemy.id !== GOBLIN_ID)
      .map((enemy) => [enemy.hpKey, 0]),
  );
  return {
    goblin,
    state: {
      ...initial, ...defeatedOthers,
      x: 1, y: 1, direction: 0, phase: 'explore',
      enemyPositions: { [GOBLIN_ID]: { x: 1, y: 2 } },
    },
  };
}

describe('MM3 rear melee ambush: face at contact, never during initiative', () => {
  it('auto-faces an authored goblin attacking from behind, then locks turning', () => {
    const { state, goblin } = rearContact();
    const fight = chroniclesStartInitiativeCombat(state, [goblin], { random: () => 0 });
    expect(fight.phase).toBe('combat');
    expect(fight.initiative.order.some((actor) => actor.kind === 'enemy' && actor.id === GOBLIN_ID)).toBe(true);
    expect(fight.direction).toBe(2);
    expect(chroniclesCombatCameraFacing(fight)).toBe(2);
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(GOBLIN_ID);
    expect(chroniclesStartInitiativeCombat(fight, [goblin])).toBe(fight);
    for (const turn of ['turn-left', 'turn-right']) {
      expect(chroniclesReduce(fight, turn)).toBe(fight);
    }
  });

  it('keeps contact facing through save/F5 without a second rotation', () => {
    const { state, goblin } = rearContact();
    const fight = chroniclesStartInitiativeCombat(state, [goblin], { random: () => 0 });
    expect(fight.direction).toBe(2);
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(fight, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), payload,
    );
    expect(restored.phase).toBe('combat');
    expect(restored.direction).toBe(2);
    expect(chroniclesCombatCameraFacing(restored)).toBe(2);
    expect(chroniclesReduce(restored, 'turn-left')).toBe(restored);
    expect(chroniclesStartInitiativeCombat(restored, [goblin])).toBe(restored);
  });

  it('does not swivel toward a forced distant shooter or in independent Tactics', () => {
    const { state, goblin } = rearContact();
    const distant = { ...state, enemyPositions: { [GOBLIN_ID]: { x: 1, y: 3 } } };
    const scripted = chroniclesStartInitiativeCombat(distant, [goblin], {
      forceEnemyIds: [GOBLIN_ID], random: () => 0,
    });
    expect(scripted.direction).toBe(0);
    const tactics = chroniclesStartInitiativeCombat(
      { ...state, combatRules: null }, [goblin], { forceEnemyIds: [GOBLIN_ID], random: () => 0 },
    );
    expect(tactics.direction).toBe(0);
  });
});

describe('MM3 restored roadside ambush: AI, targeting and scene share enemy position', () => {
  it('lets Faust strike the real adjacent salteador even when a saved override is inside masonry', () => {
    const initial = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const enemies = chroniclesActiveEnemies(initial);
    const marauder = enemies.find((enemy) => enemy.id === MARAUDER_ID);
    expect(marauder?.name).toBe('salteador de la calzada');
    const state = {
      ...initial,
      ...Object.fromEntries(enemies.filter((enemy) => enemy.id !== MARAUDER_ID)
        .map((enemy) => [enemy.hpKey, 0])),
      x: 5, y: 2, direction: 0,
      // Old checkpoints can retain an invalid override. AI has always
      // discarded it, but the attack resolver and renderer used to trust it.
      enemyPositions: { [MARAUDER_ID]: { x: 3, y: 4 } },
    };
    expect(chroniclesTileAt(3, 4, state)).toBe('#');
    expect(chroniclesRuntimeEnemyPosition(state, marauder)).toEqual({ x: 5, y: 3 });
    expect(chroniclesEnemyPosition(state, marauder)).toEqual({ x: 5, y: 3 });

    const combat = chroniclesStartInitiativeCombat(state, enemies, { random: () => 0 });
    expect(combat.phase).toBe('combat');
    expect(combat.direction).toBe(2); // Facing the attacker to the south.
    const cursor = combat.initiative.order.findIndex((actor) => actor.kind === 'party' && actor.id === 'knight');
    expect(cursor).toBeGreaterThanOrEqual(0);
    const faustTurn = { ...combat, initiative: { ...combat.initiative, cursor } };
    expect(chroniclesCombatMeleeTarget(faustTurn)?.enemy.id).toBe(MARAUDER_ID);
    const struck = chroniclesReduce(faustTurn, { type: 'attack', memberId: 'knight', mode: 'melee' });
    expect(struck.turns).toBe(faustTurn.turns + 1);
    expect(struck.direction).toBe(2);
  });

  it('keeps a valid MM3 roaming override and the independent Tactics cell contract', () => {
    const mm3 = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const enemy = chroniclesActiveEnemies(mm3).find((candidate) => candidate.id === MARAUDER_ID);
    const roaming = { ...mm3, enemyPositions: { [MARAUDER_ID]: { x: 5, y: 2 } } };
    expect(chroniclesEnemyPosition(roaming, enemy)).toEqual({ x: 5, y: 2 });
    // Existing Tactics saves deliberately follow their own coordinate policy.
    expect(chroniclesEnemyPosition({ ...roaming, combatRules: null,
      enemyPositions: { [MARAUDER_ID]: { x: 3, y: 4 } } }, enemy))
      .toEqual({ x: 3, y: 4 });
  });
});
