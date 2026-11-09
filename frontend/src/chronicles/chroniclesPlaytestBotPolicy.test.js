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
      // No turning while initiative is active; a ranged enemy can only be blocked
      // until a legal adjacent melee appears, not attacked through a wall.
      expect(playtestAction({ profile, observed: seen({ initiative: true, meleeReady: false }) })).toBe('b');
    }
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
