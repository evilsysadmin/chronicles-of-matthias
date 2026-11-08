import { describe, expect, it } from 'vitest';
import {
  chroniclesCombatPartyStepBlocked,
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { CHRONICLES_DIRECTION_KEYS } from './chroniclesKeyboardBindings.js';
import { chroniclesStartInitiativeCombat, chroniclesAdvanceCombatInitiative } from './chroniclesInitiative.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const MOVES = ['forward', 'backward', 'strafe-left', 'strafe-right'];
const ROTATIONS = ['turn-left', 'turn-right'];
const FACING_KEYS = ['ArrowLeft', 'ArrowRight'];
const encounter = (actor = 'party') => ({
  ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
  phase: 'combat',
  initiative: {
    version: 1, die: '1d8', round: 2, cursor: 0,
    order: [{ id: actor === 'party' ? 'matthias' : 'enemy', kind: actor }],
  },
  partyPositions: {
    matthias: { x: 14, y: 14 },
    rook: { x: 15, y: 14 },
  },
});

describe('Chronicles MM3 forbids all movement after melee contact', () => {
  it.each([...MOVES, ...ROTATIONS])('rejects %s on an UNSPENT hero turn without cost', (action) => {
    const state = encounter();
    expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(true);
    expect(chroniclesReduce(state, action)).toBe(state);
    expect(chroniclesReduce(state, { type: action })).toBe(state);
    expect(chroniclesReduce(state, { type: action, deferAreaTransition: true })).toBe(state);
  });
  it.each(MOVES)('rejects %s on an enemy turn without moving or spending a turn', (action) => {
    const state = encounter('enemy');
    expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(true);
    expect(chroniclesReduce(state, action)).toBe(state);
    expect(chroniclesReduce(state, { type: action })).toBe(state);
    expect(chroniclesReduce(state, { type: action, deferAreaTransition: true })).toBe(state);
  });

  it('blocks all travel shortcuts even during an enemy turn', () => {
    const state = encounter('enemy');
    for (const key of ['ArrowUp', 'ArrowDown', 'q', 'Q', 'e', 'E']) {
      const action = CHRONICLES_DIRECTION_KEYS[key];
      expect(MOVES).toContain(action);
      expect(chroniclesReduce(state, action)).toBe(state);
    }
  });

  it.each(ROTATIONS)('forbids %s during hero and enemy turns, without cost or facing changes', (action) => {
    for (const actor of ['party', 'enemy']) {
      const state = encounter(actor);
      expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(true);
      expect(chroniclesCombatPartyStepBlocked(state, { type: action })).toBe(true);
      expect(chroniclesReduce(state, action)).toBe(state);
      expect(chroniclesReduce(state, { type: action })).toBe(state);
      expect(state.initiative.round).toBe(2);
    }
    const spent = { ...encounter(), combatActionSpent: { matthias: true } };
    expect(chroniclesReduce(spent, action)).toBe(spent);
  });

  it('blocks keyboard left/right during initiative without spending an action', () => {
    const state = encounter();
    for (const key of FACING_KEYS) {
      const turn = CHRONICLES_DIRECTION_KEYS[key];
      expect(ROTATIONS).toContain(turn);
      expect(chroniclesReduce(state, turn)).toBe(state);
    }
  });

  it('restores travel immediately after initiative ends and preserves the separate Tactics rules', () => {
    const combat = encounter();
    const outsideCombat = { ...combat, initiative: null, phase: 'explore' };
    const tactics = { ...combat, combatRules: null };
    for (const action of [...MOVES, ...ROTATIONS]) {
      expect(chroniclesCombatPartyStepBlocked(outsideCombat, action)).toBe(false);
      expect(chroniclesCombatPartyStepBlocked(tactics, action)).toBe(false);
    }
    // Explore and Tactics still rotate normally and spend their normal action.
    for (const state of [outsideCombat, tactics]) {
      const rotated = chroniclesReduce(state, 'turn-right');
      expect(rotated.direction).not.toBe(state.direction);
      expect(rotated.turns).toBe(state.turns + 1);
    }
  });

  it('restores exploration if an old checkpoint retained only a distant melee creature', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const enemy = chroniclesActiveEnemies(base).find((entry) => entry.id === 'sewers-goblin-bottom-shaft');
    expect(enemy).toBeTruthy();
    const others = Object.fromEntries(chroniclesActiveEnemies(base)
      .filter((entry) => entry.id !== enemy.id)
      .map((entry) => [entry.hpKey, 0]));
    const combat = {
      ...base, ...others, phase: 'combat', x: 1, y: 5, direction: 1,
      enemyPositions: { [enemy.id]: { x: 5, y: 5 } },
      initiative: {
        round: 3, cursor: 0,
        order: [{ id: 'matthias', kind: 'party' }, { id: enemy.id, kind: 'enemy' }],
      },
    };
    const ended = chroniclesAdvanceCombatInitiative(combat, chroniclesActiveEnemies(combat));
    expect(ended.initiative).toBeNull();
    expect(ended.phase).toBe('explore');
    expect([ended.x, ended.y, ended.direction]).toEqual([1, 5, 1]);
    expect(chroniclesReduce(ended, 'turn-left').direction).not.toBe(ended.direction);
  });

  it('preserves initiative action permissions after restoring a real MM3 checkpoint', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(base).find(({ id }) => id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    const prepared = {
      ...base, x: 1, y: 1, direction: 2,
      ...Object.fromEntries(chroniclesActiveEnemies(base)
        .filter(({ id }) => id !== goblin.id).map(({ hpKey }) => [hpKey, 0])),
      enemyPositions: { [goblin.id]: { x: 1, y: 2 } },
    };
    const fight = chroniclesStartInitiativeCombat(prepared, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(fight.phase).toBe('combat');
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(fight, 1)));
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), payload,
    );
    expect(resumed.phase).toBe('combat');
    expect(resumed.initiative).toEqual(fight.initiative);
    expect([resumed.x, resumed.y, resumed.direction]).toEqual([1, 1, 2]);
    expect(chroniclesCombatPartyStepBlocked(resumed, 'turn-left')).toBe(true);
    expect(chroniclesCombatPartyStepBlocked(resumed, 'turn-right')).toBe(true);
    expect(chroniclesReduce(resumed, 'turn-left')).toBe(resumed);
    expect(chroniclesReduce(resumed, { type: 'turn-right' })).toBe(resumed);
    expect(chroniclesCombatPartyStepBlocked(resumed, 'backward')).toBe(true);
    expect(chroniclesReduce(resumed, 'backward')).toBe(resumed);
  });

  it('does not lock out non-travel combat actions', () => {
    const state = encounter();
    for (const action of ['attack', 'cast', 'use-item', 'block', 'interact']) {
      expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(false);
    }
  });
});
