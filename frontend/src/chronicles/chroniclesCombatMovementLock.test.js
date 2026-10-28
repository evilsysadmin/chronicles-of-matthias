import { describe, expect, it } from 'vitest';
import {
  chroniclesCombatPartyStepBlocked,
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { CHRONICLES_DIRECTION_KEYS } from './chroniclesKeyboardBindings.js';
import { chroniclesChooseEnemyStep, chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

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

describe('Chronicles MM3 stationary party during combat', () => {
  it.each(MOVES)('rejects %s without moving, spending a turn or altering initiative', (action) => {
    const state = encounter();
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

  it.each(ROTATIONS)('rejects %s throughout combat without changing direction or spending a turn', (action) => {
    for (const actor of ['party', 'enemy']) {
      const state = encounter(actor);
      expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(true);
      expect(chroniclesCombatPartyStepBlocked(state, { type: action })).toBe(true);
      expect(chroniclesReduce(state, action)).toBe(state);
      expect(chroniclesReduce(state, { type: action })).toBe(state);
      expect(state.initiative.round).toBe(2);
    }
  });

  it('also locks left/right keyboard shortcuts in combat', () => {
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

  it('keeps an alerted sewer goblin chasing beyond detection range, so stationary combat can finish', () => {
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
    // This goblin only detects within three cells. It was recruited to its
    // squad's existing fight, so moving one legal cardinal square toward the
    // party is required even when it currently stands four tiles away.
    expect(chroniclesChooseEnemyStep(combat, enemy)).toEqual({ x: 4, y: 5 });
    const acted = chroniclesResolveEnemyActor(combat, enemy.id);
    expect(acted.enemyPositions[enemy.id]).toEqual({ x: 4, y: 5 });
    expect(acted.enemyTurnEvents).toMatchObject([
      { type: 'move', enemyId: enemy.id },
    ]);
    expect([acted.x, acted.y]).toEqual([1, 5]);
  });

  it('does not lock out non-travel combat actions', () => {
    const state = encounter();
    for (const action of ['attack', 'cast', 'use-item', 'block', 'interact']) {
      expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(false);
    }
  });
});
