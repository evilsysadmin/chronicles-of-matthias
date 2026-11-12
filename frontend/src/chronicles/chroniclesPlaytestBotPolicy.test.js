import { describe, expect, it } from 'vitest';
import {
  PLAYTEST_MAX_COMBAT_ACTIONS, PLAYTEST_MAX_EXPLORATION_ACTIONS,
  PLAYTEST_PROFILES, playtestAction, playtestOutcome, playtestSummary,
} from '../../smoke/playtest-policy.mjs';

const seen = (overrides = {}) => ({
  phase: 'explore', initiative: false, enemyTurn: false, meleeReady: false,
  ...overrides,
});

describe('public staging Playwright bot policy', () => {
  it('supports two reproducible strategies with bounded runtime', () => {
    expect(PLAYTEST_PROFILES).toEqual(['aggressive', 'cautious']);
    expect(PLAYTEST_MAX_COMBAT_ACTIONS).toBeLessThanOrEqual(40);
    expect(PLAYTEST_MAX_EXPLORATION_ACTIONS).toBeLessThanOrEqual(12);
    for (const profile of PLAYTEST_PROFILES) {
      expect(playtestAction({ profile, observed: seen(), explorationActions: 0 })).toBe('s');
      expect(playtestAction({ profile, observed: seen(), explorationActions: 1 })).toBe('ArrowUp');
      expect(playtestAction({ profile, observed: seen(), explorationActions: 5, blocked: 2 })).toBe('ArrowRight');
    }
    expect(() => playtestAction({ profile: 'overpowered', observed: seen() })).toThrow('Unknown');
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
      episodes: 2, wins: 1, defeats: 1, unresolved: 0, averageHpLost: 22, averageActions: 12,
    });
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
