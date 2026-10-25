import { describe, expect, it } from 'vitest';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesEngagedEnemies,
  chroniclesRollInitiative,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';

describe('Chronicles initiative rejects non-finite legacy HP', () => {
  const enemy = {
    id: 'specter', name: 'Specter', hpKey: 'specterHp',
    x: 2, y: 3, ai: { movement: 'hold', engageRange: 1 },
  };
  const party = [{ id: 'matthias', name: 'Matthias', hp: 7, agility: 4 }];

  it('never engages an infinite-HP enemy by proximity or a forced encounter', () => {
    const state = { phase: 'explore', x: 2, y: 2, party, specterHp: Infinity };
    expect(chroniclesEngagedEnemies(state, [enemy])).toEqual([]);
    expect(chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 })).toBe(state);
    expect(chroniclesStartInitiativeCombat(state, [enemy], {
      forceEnemyIds: ['specter'], random: () => 0,
    })).toBe(state);
  });

  it('excludes infinite-HP actors while preserving valid numeric-string HP', () => {
    const state = {
      party: [
        { id: 'invalid', hp: Infinity, agility: 99 },
        { id: 'matthias', hp: '7', agility: 4 },
      ],
      specterHp: Infinity,
      validHp: '3',
    };
    const validEnemy = { ...enemy, id: 'valid', hpKey: 'validHp' };
    const rolled = chroniclesRollInitiative(state, [enemy, validEnemy], { random: () => 0 });
    expect(rolled.order.map((actor) => actor.id).sort()).toEqual(['matthias', 'valid']);
  });

  it('ends combat when the only remaining enemy has non-finite HP', () => {
    const state = {
      phase: 'combat', x: 2, y: 2, party, specterHp: Infinity,
      initiative: {
        version: 1, die: '1d8', round: 2, cursor: 0,
        order: [
          { kind: 'party', id: 'matthias', initiative: 8 },
          { kind: 'enemy', id: 'specter', initiative: 4 },
        ],
      },
    };
    const next = chroniclesAdvanceCombatInitiative(state, [enemy]);
    expect(next.phase).toBe('explore');
    expect(next.initiative).toBeNull();
  });

  it('does not create a combat when every hero has non-finite HP', () => {
    const state = {
      phase: 'explore', x: 2, y: 2,
      party: [{ id: 'matthias', hp: Infinity, agility: 4 }],
      specterHp: 3,
    };
    expect(chroniclesStartInitiativeCombat(state, [enemy], { random: () => 0 })).toBe(state);
  });
});
