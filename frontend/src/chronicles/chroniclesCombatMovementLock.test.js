import { describe, expect, it } from 'vitest';
import {
  chroniclesCombatPartyStepBlocked,
  chroniclesActiveEnemies,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { CHRONICLES_DIRECTION_KEYS } from './chroniclesKeyboardBindings.js';
import { chroniclesChooseEnemyStep, chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
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

describe('Chronicles MM3 movement consumes initiative', () => {
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

  it.each(ROTATIONS)('charges %s one hero action, never free rotation', (action) => {
    const state = encounter();
    expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(false);
    const turned = chroniclesReduce(state, action);
    expect(turned.direction).toBe((state.direction + (action === 'turn-left' ? 3 : 1)) % 4);
    expect(turned.turns).toBe(state.turns + 1);
    expect(turned.combatActionSpent?.matthias).toBe(true);
    expect(chroniclesCombatPartyStepBlocked(turned, action)).toBe(true);
    expect(chroniclesReduce(turned, action)).toBe(turned);
    const enemyTurn = encounter('enemy');
    expect(chroniclesCombatPartyStepBlocked(enemyTurn, action)).toBe(true);
    expect(chroniclesReduce(enemyTurn, action)).toBe(enemyTurn);
  });

  it('routes the keyboard left/right turns through the same initiative budget', () => {
    const state = encounter();
    for (const key of FACING_KEYS) {
      const turn = CHRONICLES_DIRECTION_KEYS[key];
      expect(ROTATIONS).toContain(turn);
      expect(chroniclesReduce(state, turn).turns).toBe(state.turns + 1);
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
    const actor = resumed.initiative.order[resumed.initiative.cursor];
    const permitted = actor.kind === 'party' && actor.asleep !== true;
    expect(chroniclesCombatPartyStepBlocked(resumed, 'turn-left')).toBe(!permitted);
    const rotated = chroniclesReduce(resumed, 'turn-left');
    if (permitted) {
      expect(rotated.turns).toBe(resumed.turns + 1);
      expect(rotated.combatActionSpent?.[actor.id]).toBe(true);
    } else {
      expect(rotated).toBe(resumed);
    }
  });

  it('does not lock out non-travel combat actions', () => {
    const state = encounter();
    for (const action of ['attack', 'cast', 'use-item', 'block', 'interact']) {
      expect(chroniclesCombatPartyStepBlocked(state, action)).toBe(false);
    }
  });
});
