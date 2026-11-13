import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesCombatCameraFacing } from './chroniclesCombatCameraFacing.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const GOBLIN_ID = 'sewers-goblin-west';

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
