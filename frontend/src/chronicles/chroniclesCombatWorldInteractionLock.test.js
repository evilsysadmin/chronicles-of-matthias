import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

const SEWER_EXIT = 'sewers-to-swordhaven';
const CROSSINGS = [
  ['interact', { type: 'interact' }],
  ['confirmed threshold', { type: 'cross-area-threshold', exitId: SEWER_EXIT }],
];

function sewerEntrance() {
  const state = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  expect(state.phase).toBe('explore');
  expect(chroniclesAreaTransitionIntent(state, 'interact')?.exitId).toBe(SEWER_EXIT);
  return state;
}

function sewerFightAtExit() {
  const state = sewerEntrance();
  const goblin = chroniclesActiveEnemies(state).find((enemy) => enemy.id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  const combat = chroniclesStartInitiativeCombat(state, [goblin], {
    forceEnemyIds: [goblin.id], random: () => 0,
  });
  expect(combat.phase).toBe('combat');
  expect(combat.initiative?.order.some((actor) => actor.kind === 'enemy')).toBe(true);
  return combat;
}

describe('MM3 initiative locks world interactions and floor exits', () => {
  it.each(CROSSINGS)('still allows %s to leave the sewers in exploration', (_label, action) => {
    const state = sewerEntrance();
    const next = chroniclesReduce(state, action);
    expect(next.mapId).toBe('swordhaven-first-book');
    expect(next.initiative).toBeNull();
  });

  it.each(['party', 'enemy'])('refuses both crossings during a %s initiative slot', (kind) => {
    const combat = sewerFightAtExit();
    const cursor = combat.initiative.order.findIndex((actor) => actor.kind === kind);
    expect(cursor).toBeGreaterThanOrEqual(0);
    const state = { ...combat, initiative: { ...combat.initiative, cursor } };
    expect(chroniclesAreaTransitionIntent(state, 'interact')).toBeNull();
    for (const [_label, action] of CROSSINGS) {
      // No teleport, quest interaction, initiative tick or save-visible mutation.
      expect(chroniclesReduce(state, action)).toBe(state);
    }
  });
});
