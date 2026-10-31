import { describe, expect, it, vi } from 'vitest';
import { tacticsResolvePlayerAction } from './tacticsTurnResolution.js';

function ports(overrides = {}) {
  return {
    prepareExplorationSpawn: vi.fn(state => state),
    advanceCombatInitiative: vi.fn(state => ({ ...state, advanced: true })),
    activeEnemies: vi.fn(state => state.enemies || []),
    combatActive: vi.fn(state => Boolean(state.engaged)),
    advanceExplorationEnemies: vi.fn((_previous, next) => ({ ...next, enemiesStepped: true })),
    startInitiativeCombat: vi.fn((state, enemies, options) => ({
      ...state, phase: 'combat', actors: enemies.map(enemy => enemy.id),
      forcedIds: options.forceEnemyIds, message: 'Iniciativa.',
    })),
    ...overrides,
  };
}

describe('pure Tactics player-turn resolution port contract', () => {
  it('never advances a defeated or escaped run or consumes a null action', () => {
    const provider = ports();
    const defeated = { phase: 'defeated' };
    expect(tacticsResolvePlayerAction(defeated, { phase: 'combat' }, { ports: provider })).toBe(defeated);
    expect(tacticsResolvePlayerAction(defeated, null, { ports: provider })).toBe(defeated);
    expect(provider.startInitiativeCombat).not.toHaveBeenCalled();
  });

  it('advances one existing initiative slot only when a legal action changed state', () => {
    const provider = ports();
    const before = { phase: 'combat', initiative: { order: [{ kind: 'party', id: 'rook' }] } };
    expect(tacticsResolvePlayerAction(before, before, { ports: provider })).toBe(before);
    expect(provider.advanceCombatInitiative).not.toHaveBeenCalled();
    const next = { ...before, turns: 1 };
    expect(tacticsResolvePlayerAction(before, next, { ports: provider })).toMatchObject({ advanced: true });
    expect(provider.advanceCombatInitiative).toHaveBeenCalledTimes(1);
  });

  it('preserves exploration cadence and starts encounter after real enemy movement', () => {
    const provider = ports({
      advanceExplorationEnemies: vi.fn((_before, next) => ({ ...next, engaged: true, message: 'Contacto.' })),
    });
    const before = { phase: 'explore', engaged: false, enemies: [{ id: 'pawn' }] };
    const next = { ...before, turns: 1 };
    const after = tacticsResolvePlayerAction(before, next, { ports: provider, random: () => 0 });
    expect(after.phase).toBe('combat');
    expect(after.message).toContain('Contacto. Iniciativa.');
    expect(provider.startInitiativeCombat).toHaveBeenCalledWith(
      expect.objectContaining({ engaged: true }),
      [{ id: 'pawn' }],
      expect.objectContaining({ forceEnemyIds: ['pawn'], random: expect.any(Function) }),
    );
  });

  it('rolls before a forced attack and does not commit premature damage', () => {
    const provider = ports();
    const before = { phase: 'explore', enemies: [{ id: 'pawn' }], turns: 0, hp: 9 };
    const attempted = { ...before, turns: 1, hp: 4 };
    const after = tacticsResolvePlayerAction(before, attempted, {
      forceCombat: true, forceEnemyIds: ['pawn', 'pawn', 'bishop'], ports: provider, random: () => 0,
    });
    expect(after.hp).toBe(9);
    expect(after.turns).toBe(0);
    expect(after.forcedIds).toEqual(['pawn', 'bishop']);
  });

  it('prepares safe exploration spawn on a genuine map transition', () => {
    const provider = ports({
      prepareExplorationSpawn: vi.fn(state => ({ ...state, spawnPrepared: true })),
    });
    const previous = { phase: 'explore', mapId: 'crypt', explorationEnemySteps: 5 };
    const next = { ...previous, mapId: 'town' };
    const result = tacticsResolvePlayerAction(previous, next, { ports: provider });
    expect(result).toMatchObject({ mapId: 'town', explorationEnemySteps: 0, spawnPrepared: true });
    expect(provider.startInitiativeCombat).not.toHaveBeenCalled();
  });
});
