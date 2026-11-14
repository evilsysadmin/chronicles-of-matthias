import { describe, expect, it } from 'vitest';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import {
  PLAYTEST_MAX_COMBAT_ACTIONS, PLAYTEST_MAX_EXPLORATION_ACTIONS,
  PLAYTEST_PROFILES, PLAYTEST_CAMPAIGN_ENTRY_MAP_ID, PLAYTEST_OPENING_ROUTE,
  PLAYTEST_OPENING_FLAG, PLAYTEST_BOARD_ROUTE, PLAYTEST_BOARD_FLAG,
  PLAYTEST_BOARD_QUEST_ID, playtestTileKey,
  playtestMovedBetweenTiles,
  playtestViewport, playtestAction, playtestOutcome, playtestSummary,
  playtestAcceptance,
  verifyPlaytestCheckpoint, playtestFailureEpisode, playtestMobileTouchAction,
} from '../../smoke/playtest-policy.mjs';

const seen = (overrides = {}) => ({
  phase: 'explore', initiative: false, enemyTurn: false, meleeReady: false,
  ...overrides,
});

describe('public staging Playwright bot policy', () => {
  it('supports two reproducible strategies with bounded runtime', () => {
    expect(PLAYTEST_PROFILES).toEqual(['aggressive', 'cautious']);
    expect(PLAYTEST_MAX_COMBAT_ACTIONS).toBeLessThanOrEqual(40);
    expect(PLAYTEST_MAX_EXPLORATION_ACTIONS).toBeGreaterThanOrEqual(20);
    expect(PLAYTEST_MAX_EXPLORATION_ACTIONS).toBeLessThanOrEqual(32);
    for (const profile of PLAYTEST_PROFILES) {
      expect(playtestAction({ profile, observed: seen(), explorationActions: 0 })).toBe('ArrowUp');
      expect(playtestAction({ profile, observed: seen(), explorationActions: 1 })).toBe('ArrowUp');
      expect(playtestAction({ profile, observed: seen(), explorationActions: 5, blocked: 2 })).toBe('ArrowRight');
    }
    expect(() => playtestAction({ profile: 'overpowered', observed: seen() })).toThrow('Unknown');
  });

  it('starts fresh public first-person playtests in Swordhaven, never the old crypt', () => {
    expect(PLAYTEST_CAMPAIGN_ENTRY_MAP_ID).toBe('swordhaven-first-book');
    expect(playtestOutcome({
      observed: seen(), enemyHp: null, combatEntered: false,
      explorationActions: 8, combatActions: 0,
      startHp: 30, endHp: 30, scenario: 'campaign-start',
    })).toEqual({ outcome: 'exploration', warnings: [], hpLost: 0, actions: 8 });
  });

  it('walks the real Swordhaven opening to the sealed letter, without shortcuts', () => {
    const start = swordhavenFirstBook.partyStart;
    expect(start).toEqual({ x: 9, y: 7, direction: 0 });
    expect(swordhavenFirstBook.id).toBe(PLAYTEST_CAMPAIGN_ENTRY_MAP_ID);
    let x = start.x;
    let y = start.y;
    let direction = start.direction;
    const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const step of PLAYTEST_OPENING_ROUTE) {
      if (step.action === 'ArrowLeft') direction = (direction + 3) % 4;
      else if (step.action === 'ArrowUp') {
        x += vectors[direction][0];
        y += vectors[direction][1];
        expect(swordhavenFirstBook.grid[y][x]).not.toBe('#');
      } else throw new Error('Unexpected opening action');
      expect({ x, y }).toEqual({ x: step.x, y: step.y });
    }
    const letter = swordhavenFirstBook.interactables.find(item => item.id === 'sealed-order');
    expect(letter?.label).toBe('El sobre de la Dama');
    expect({ x: x + vectors[direction][0], y: y + vectors[direction][1] })
      .toEqual({ x: letter.x, y: letter.y });
    expect(letter.action.effects).toContainEqual({
      type: 'set', key: PLAYTEST_OPENING_FLAG, value: true,
    });
  });

  it('distinguishes walking from rotation and catches missing or impossible tile observations', () => {
    const base = { mapId: PLAYTEST_CAMPAIGN_ENTRY_MAP_ID, x: 9, y: 7, turns: 0 };
    expect(playtestTileKey(base)).toBe('9,7');
    expect(playtestMovedBetweenTiles(base, { ...base, x: 9, y: 6, turns: 1 })).toBe(true);
    expect(playtestMovedBetweenTiles(base, { ...base, turns: 1 })).toBe(false);
    expect(playtestMovedBetweenTiles(base, { ...base })).toBe(false);
    expect(playtestTileKey({ x: null, y: 7 })).toBeNull();
    expect(() => playtestMovedBetweenTiles(base, { ...base, x: null }))
      .toThrow('BOT_MISSING_VISIBLE_PARTY_TILE');
    expect(() => playtestMovedBetweenTiles(base, { ...base, x: 12 }))
      .toThrow('BOT_NONLOCAL_EXPLORATION_MOVEMENT');
    expect(() => playtestMovedBetweenTiles(base, {
      ...base, mapId: 'another-area',
    })).toThrow('BOT_UNEXPECTED_MAP_TRANSITION');
  });

  it('emulates an actual landscape phone instead of a blocked portrait viewport', () => {
    const desktop = playtestViewport('aggressive');
    const phone = playtestViewport('cautious');
    expect(desktop).toEqual({ width: 1280, height: 800, touch: false });
    expect(phone).toEqual({ width: 844, height: 390, touch: true });
    expect(phone.width).toBeGreaterThan(phone.height);
    expect(phone.width).toBeLessThanOrEqual(920);
    expect(phone.height).toBeLessThanOrEqual(620);
    expect(Object.isFrozen(phone)).toBe(true);
    expect(() => playtestViewport('invalid')).toThrow('Unknown playtest profile');
  });

  it('uses only real mobile HUD slots and never routes combat rotation', () => {
    expect(playtestMobileTouchAction('ArrowUp')).toBe('forward');
    expect(playtestMobileTouchAction('ArrowDown')).toBe('backward');
    expect(playtestMobileTouchAction('ArrowLeft')).toBe('turn-left');
    expect(playtestMobileTouchAction('ArrowRight')).toBe('turn-right');
    expect(playtestMobileTouchAction('ArrowRight', { initiative: true })).toBeNull();
    expect(playtestMobileTouchAction('ArrowLeft', { initiative: true })).toBeNull();
    expect(playtestMobileTouchAction('q', { initiative: true })).toBe('strafe-left');
    expect(playtestMobileTouchAction('e', { initiative: true })).toBe('strafe-right');
    expect(playtestMobileTouchAction('q')).toBe('strafe-left');
    expect(playtestMobileTouchAction('e')).toBe('strafe-right');
    expect(playtestMobileTouchAction('s')).toBe('attack');
    expect(playtestMobileTouchAction('a')).toBe('attack');
    expect(playtestMobileTouchAction('b')).toBe('block');
    for (const forbidden of ['turn-left', 'turn-right', 'Escape', null]) {
      expect(playtestMobileTouchAction(forbidden)).toBeNull();
    }
  });

  it('never acts during enemy initiative or after a defeat', () => {
    for (const profile of PLAYTEST_PROFILES) {
      expect(playtestAction({ profile, observed: seen({ initiative: true, enemyTurn: true }) })).toBeNull();
      expect(playtestAction({ profile, observed: seen({ phase: 'defeated' }) })).toBeNull();
      expect(playtestAction({ profile, observed: seen({ phase: 'escaped' }) })).toBeNull();
      // Never turn during initiative. A distant or rear enemy requires
      // deliberate repositioning; blocked moves can fall back to defense.
      const step = profile === 'aggressive' ? 'ArrowUp' : 'ArrowDown';
      expect(playtestAction({ profile, observed: seen({ initiative: true, meleeReady: false }) })).toBe(step);
      expect(playtestAction({ profile, observed: seen({ initiative: true, meleeReady: false }), blocked: 4 })).toBe('b');
    }
  });

  it('tries every direction without rotating and can recover from rejected combat steps', () => {
    const distant = seen({ initiative: true, meleeReady: false });
    expect([0, 1, 2, 3].map(blocked => playtestAction({
      profile: 'aggressive', observed: distant, blocked,
    }))).toEqual(['ArrowUp', 'ArrowDown', 'q', 'e']);
    expect([0, 1, 2, 3].map(blocked => playtestAction({
      profile: 'cautious', observed: distant, blocked,
    }))).toEqual(['ArrowDown', 'ArrowUp', 'e', 'q']);
    expect(playtestAction({
      profile: 'aggressive', observed: distant, repositionSteps: 1,
    })).toBe('ArrowUp');
    expect(playtestAction({
      profile: 'aggressive', observed: distant, repositionSteps: 3,
    })).toBe('ArrowDown');
    expect(playtestAction({
      profile: 'cautious', observed: distant, repositionSteps: 2,
    })).toBe('ArrowDown');
    expect(playtestAction({
      profile: 'aggressive', observed: distant, blocked: 4,
    })).toBe('b');
    expect(playtestAction({
      profile: 'aggressive', observed: distant, blocked: 4, combatActions: 10,
    })).toBe('b');
    expect(playtestAction({
      profile: 'aggressive', observed: seen({ initiative: true, meleeReady: true }),
    })).toBe('a');
  });

  it('uses measured, deterministic defensive cadence without inventing resources', () => {
    const nearby = seen({ initiative: true, meleeReady: true });
    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(playtestAction({ profile: 'aggressive', observed: nearby, combatActions: n })).toBe('a');
      expect(playtestAction({ profile: 'cautious', observed: nearby, combatActions: n, seed: 1 }))
        .toBe((n + 1) % 3 === 0 ? 'b' : 'a');
    }
  });

  it('reports wins and warnings as evidence, not automatic balance failures', () => {
    const victory = playtestOutcome({
      observed: seen(), enemyHp: 0, combatEntered: true,
      explorationActions: 3, combatActions: 6, startHp: 30, endHp: 16,
    });
    const defeat = playtestOutcome({
      observed: seen({ phase: 'defeated' }), enemyHp: 3, combatEntered: true,
      explorationActions: 3, combatActions: 12, startHp: 30, endHp: 0,
    });
    expect(victory).toMatchObject({ outcome: 'victory', hpLost: 14, actions: 9, warnings: [] });
    expect(defeat.warnings).toContain('party-defeated');
    expect(playtestSummary([victory, defeat])).toEqual({
      episodes: 2, measuredEpisodes: 2, errors: 0,
      wins: 1, defeats: 1, explorationEpisodes: 0, unresolved: 0,
      averageHpLost: 22, averageActions: 12,
    });
  });

  it('validates real Swordhaven exploration and persistence without inventing early combat', () => {
    const complete = (profile, overrides = {}) => ({
      profile, mapId: PLAYTEST_CAMPAIGN_ENTRY_MAP_ID,
      outcome: 'exploration', combatEntered: false, explorationCommitted: 5,
      explorationMoves: 5, distinctExplorationTiles: 6,
      openingNarrativeVerified: true,
      saved: true, restored: true, preCombatSaved: true, preCombatRestored: true,
      preCombatEnemyHp: null, postCombatSaved: true, postCombatRestored: true,
      ...overrides,
    });
    const aggressive = complete('aggressive');
    const cautious = complete('cautious');
    expect(playtestAcceptance([aggressive, cautious])).toEqual({
      passed: true, reasons: [],
    });
    expect(playtestAcceptance([aggressive, complete('cautious', {
      openingNarrativeVerified: false,
    })]).reasons).toEqual(['opening-letter-not-verified:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      mapId: 'crypt-eight-squares',
    })]).reasons).toEqual(['wrong-campaign-entry:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      explorationCommitted: 6, explorationMoves: 0, distinctExplorationTiles: 1,
    })]).reasons).toEqual(['no-exploration-progress:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      explorationCommitted: 6, explorationMoves: 5, distinctExplorationTiles: 2,
    })]).reasons).toEqual(['no-exploration-progress:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      outcome: 'no-contact',
    })]).reasons).toEqual(['invalid-campaign-opening-outcome:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      postCombatRestored: false,
    })]).reasons).toEqual(['post-exploration-checkpoint-missing:cautious']);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      saved: false, preCombatRestored: false,
    })]).reasons).toEqual(['checkpoint-not-verified:cautious']);
    // Swordhaven can have a genuine early encounter, but no forced one.
    expect(playtestAcceptance([aggressive, complete('cautious', {
      outcome: 'defeat', combatEntered: true, explorationCommitted: 0,
      postCombatSaved: false, postCombatRestored: false,
    })]).passed).toBe(true);
    expect(playtestAcceptance([aggressive, complete('cautious', {
      outcome: 'error', combatEntered: false,
    })]).reasons).toEqual(['bot-execution-failed:cautious']);
    expect(playtestAcceptance([aggressive]).reasons).toEqual(['missing-profile:cautious']);
    expect(playtestAcceptance([aggressive, aggressive, cautious]).reasons)
      .toEqual(['duplicate-profile:aggressive']);
    expect(playtestAcceptance([aggressive, cautious, { profile: 'unknown' }]).reasons)
      .toEqual(['unexpected-profile']);
    expect(playtestAcceptance(null)).toEqual({ passed: false, reasons: ['missing-episodes'] });
  });

  it('flags sustained lack of legal melee from accepted combat actions only', () => {
    const distant = {
      observed: seen({ initiative: true, meleeReady: false }),
      enemyHp: 6, combatEntered: true,
      explorationActions: 2, startHp: 30, endHp: 20,
      meleeOpportunities: 0,
    };
    expect(playtestOutcome({ ...distant, combatActions: 11 }).warnings)
      .not.toContain('no-melee-access-after-12-actions');
    expect(playtestOutcome({ ...distant, combatActions: 12 }).warnings)
      .toContain('no-melee-access-after-12-actions');
    expect(playtestOutcome({ ...distant, combatActions: 12, meleeOpportunities: 1 }).warnings)
      .not.toContain('no-melee-access-after-12-actions');
    expect(playtestOutcome({ ...distant, combatActions: 12, enemyHp: 0 }).warnings)
      .not.toContain('no-melee-access-after-12-actions');
    expect(playtestOutcome({ ...distant, combatActions: 12, meleeOpportunities: null }).warnings)
      .not.toContain('no-melee-access-after-12-actions');
    expect(playtestOutcome({
      ...distant, combatActions: 3, rejectedCombatMoves: 9,
    }).warnings).toEqual(['encounter-not-resolved', 'repeated-rejected-combat-moves']);
  });

  it('preserves bounded failure evidence without distorting balance statistics', () => {
    const trace = Array.from({ length: 30 }, (_, i) => ({
      action: i % 2 ? 'ArrowDown' : 'q', turns: i,
      partyHp: 32 - i, phase: 'explore', initiative: false, elapsedMs: i * 50,
      actor: 'should-not-be-copied', token: 'must-not-appear',
    }));
    const failure = playtestFailureEpisode({
      profile: 'aggressive', seed: 11, viewport: 390,
      lastObserved: { mapId: 'crypt-eight-squares', turns: 29, partyHp: 3, phase: 'explore' },
      trace, error: 'BOT_SOFTLOCK_EXPLORE',
    });
    expect(failure).toMatchObject({
      outcome: 'error', hpLost: null, actions: null,
      attemptedInputs: 30, retainedTraceLength: 24,
      lastTurn: 29, lastPartyHp: 3,
      mapId: 'crypt-eight-squares',
    });
    expect(failure.trace[0].turns).toBe(6);
    expect(JSON.stringify(failure)).not.toContain('must-not-appear');
    expect(JSON.stringify(failure)).not.toContain('should-not-be-copied');
    expect(playtestSummary([failure])).toEqual({
      episodes: 1, measuredEpisodes: 0, errors: 1,
      wins: 0, defeats: 0, explorationEpisodes: 0, unresolved: 0,
      averageHpLost: null, averageActions: null,
    });
    const legitimate = { outcome: 'victory', hpLost: 12, actions: 7 };
    expect(playtestSummary([legitimate, failure])).toMatchObject({
      episodes: 2, measuredEpisodes: 1, errors: 1,
      wins: 1, explorationEpisodes: 0, unresolved: 0,
      averageHpLost: 12, averageActions: 7,
    });
  });

  it('checks both authoritative checkpoint snapshots, including after a defeat', () => {
    const checkpoint = (overrides = {}) => ({
      runId: 'run-test', currentMapId: 'crypt-eight-squares',
      worldFlags: { '__chrRuntime.turns': 2, enemyHp: 8 },
      ...overrides,
    });
    const input = {
      runId: 'run-test', mapId: 'crypt-eight-squares', turns: 2,
      saved: checkpoint(), restored: checkpoint(),
    };
    expect(verifyPlaytestCheckpoint(input)).toEqual({ enemyHp: 8 });
    expect(() => verifyPlaytestCheckpoint({
      ...input, restored: checkpoint({ runId: 'another-run' }),
    })).toThrow('BOT_CHECKPOINT_restored_RUN_MISMATCH');
    expect(() => verifyPlaytestCheckpoint({
      ...input, saved: checkpoint({ currentMapId: 'wrong-map' }),
    })).toThrow('BOT_CHECKPOINT_saved_MAP_MISMATCH');
    expect(() => verifyPlaytestCheckpoint({
      ...input, restored: checkpoint({ worldFlags: { '__chrRuntime.turns': 1, enemyHp: 8 } }),
    })).toThrow('BOT_CHECKPOINT_restored_TURNS_MISMATCH');
    expect(() => verifyPlaytestCheckpoint({
      ...input, restored: checkpoint({ worldFlags: { '__chrRuntime.turns': 2, enemyHp: 9 } }),
    })).toThrow('BOT_CHECKPOINT_ENEMY_HP_MISMATCH');
    expect(() => verifyPlaytestCheckpoint({
      ...input, saved: checkpoint({ worldFlags: { '__chrRuntime.turns': 2 } }),
    })).toThrow('BOT_CHECKPOINT_INVALID_ENEMY_HP');
  });

  it('restores Swordhaven checkpoints without requiring a retired crypt enemyHp', () => {
    const initial = {
      runId: 'run-swordhaven',
      currentMapId: PLAYTEST_CAMPAIGN_ENTRY_MAP_ID,
      worldFlags: {
        '__chrRuntime.turns': 3,
        swordhavenSouthCutpurseHp: 6,
      },
    };
    const args = {
      runId: 'run-swordhaven', mapId: PLAYTEST_CAMPAIGN_ENTRY_MAP_ID,
      turns: 3, saved: initial, restored: initial,
    };
    expect(verifyPlaytestCheckpoint(args)).toEqual({ enemyHp: null });
    const storySaved = { ...initial, worldFlags: {
      ...initial.worldFlags, [PLAYTEST_OPENING_FLAG]: true,
    } };
    expect(verifyPlaytestCheckpoint({
      ...args, saved: storySaved, restored: storySaved,
      requiredFlags: [PLAYTEST_OPENING_FLAG],
    })).toEqual({ enemyHp: null });
    expect(() => verifyPlaytestCheckpoint({
      ...args, saved: storySaved, restored: initial,
      requiredFlags: [PLAYTEST_OPENING_FLAG],
    })).toThrow('BOT_CHECKPOINT_MISSING_OPENING_FLAG');
    expect(() => verifyPlaytestCheckpoint({
      ...args, saved: initial, restored: storySaved,
      requiredFlags: [PLAYTEST_OPENING_FLAG],
    })).toThrow('BOT_CHECKPOINT_MISSING_OPENING_FLAG');
    expect(verifyPlaytestCheckpoint({
      ...args,
      saved: { ...initial, worldFlags: { '__chrRuntime.turns': 3 } },
      restored: { ...initial, worldFlags: { '__chrRuntime.turns': 3 } },
    })).toEqual({ enemyHp: null });
    expect(() => verifyPlaytestCheckpoint({
      ...args,
      restored: { ...initial, worldFlags: {
        '__chrRuntime.turns': 3, swordhavenSouthCutpurseHp: 5,
      } },
    })).toThrow('BOT_CHECKPOINT_ENEMY_HP_MISMATCH');
    expect(() => verifyPlaytestCheckpoint({
      ...args, restored: { ...initial, currentMapId: 'crypt-eight-squares' },
    })).toThrow('BOT_CHECKPOINT_restored_MAP_MISMATCH');
  });

  it('flags inaccessible enemies, protracted fights and expensive victories', () => {
    const unreachable = playtestOutcome({
      observed: seen(), enemyHp: 5, combatEntered: false,
      explorationActions: 8, combatActions: 0, startHp: 20, endHp: 20,
    });
    const costly = playtestOutcome({
      observed: seen(), enemyHp: 0, combatEntered: true,
      explorationActions: 3, combatActions: 22, startHp: 20, endHp: 2,
    });
    expect(unreachable).toMatchObject({ outcome: 'no-contact', warnings: ['enemy-unreachable'] });
    expect(costly.warnings).toEqual(['party-lost-70pct-hp', 'long-combat']);
  });
});
