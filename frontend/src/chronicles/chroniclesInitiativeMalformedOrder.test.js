import { describe, expect, it } from 'vitest';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesAdvanceInitiative,
  chroniclesCurrentInitiativeActor,
} from './chroniclesInitiative.js';

const hero = { kind: 'party', id: 'matthias', initiative: 9 };
const goblin = { kind: 'enemy', id: 'goblin', initiative: 7 };
const enemies = [{ id: 'goblin', hpKey: 'goblinHp' }];

function savedCombat(order, hp = 7) {
  return JSON.parse(JSON.stringify({
    phase: 'combat',
    turnPhase: 'enemy',
    x: 3,
    y: 4,
    direction: 2,
    turns: 11,
    party: [{ id: 'matthias', hp }],
    goblinHp: 4,
    combatBlock: { matthias: true },
    combatWard: { matthias: 1 },
    enemyStatus: { goblin: { paralyzed: 1 } },
    initiative: { version: 1, die: '1d8', round: 3, cursor: 0, order },
  }));
}

describe('MM3 malformed saved initiative order', () => {
  it.each([
    ['missing', null],
    ['empty', []],
    ['string', 'matthias,goblin'],
    ['array-like object', { 0: hero, 1: goblin, length: 2 }],
  ])('recovers a %s order without phantom turns or a stuck combat', (_label, order) => {
    const restored = savedCombat(order);
    expect(chroniclesCurrentInitiativeActor(restored.initiative)).toBeNull();
    expect(chroniclesAdvanceInitiative(restored.initiative)).toBe(restored.initiative);

    const next = chroniclesAdvanceCombatInitiative(restored, enemies);
    expect(next.phase).toBe('explore');
    expect(next.turnPhase).toBe('party');
    expect(next.initiative).toBeNull();
    expect([next.x, next.y, next.direction, next.turns]).toEqual([3, 4, 2, 11]);
    expect(next.party[0].hp).toBe(7);
    expect(next.goblinHp).toBe(4);
    expect(next.combatBlock).toBeUndefined();
    expect(next.combatWard).toBeUndefined();
    expect(next.enemyStatus).toBeUndefined();
  });

  it('still resolves defeat when the last hero has fallen', () => {
    const next = chroniclesAdvanceCombatInitiative(savedCombat('broken', 0), enemies);
    expect(next.phase).toBe('defeated');
    expect(next.initiative).toBeNull();
  });

  it('keeps ordinary saved actor arrays playable', () => {
    const restored = savedCombat([hero, goblin]);
    expect(chroniclesCurrentInitiativeActor(restored.initiative)).toMatchObject(hero);
    const next = chroniclesAdvanceCombatInitiative(restored, enemies);
    expect(next.phase).toBe('combat');
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject(goblin);
    expect(next.initiative.round).toBe(3);
  });
});
