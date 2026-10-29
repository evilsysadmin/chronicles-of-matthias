import { describe, expect, it } from 'vitest';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
} from './chroniclesInitiative.js';

const hero = { kind: 'party', id: 'matthias', initiative: 9 };
const goblin = { kind: 'enemy', id: 'goblin', initiative: 7 };
const enemies = [{ id: 'goblin', hpKey: 'goblinHp' }];

function restoredCombat(order, cursor) {
  return JSON.parse(JSON.stringify({
    phase: 'combat',
    party: [{ id: 'matthias', hp: 7 }],
    goblinHp: 4,
    initiative: { version: 1, die: '1d8', round: 3, cursor, order },
  }));
}

describe('MM3 restored initiative with null actor slots', () => {
  it('skips a null current slot without stealing the next enemy turn', () => {
    const next = chroniclesAdvanceCombatInitiative(
      restoredCombat([hero, null, goblin], 1),
      enemies,
    );
    expect(next.phase).toBe('combat');
    expect(next.initiative.order.map(({ id }) => id)).toEqual(['matthias', 'goblin']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject(goblin);
    expect(next.initiative.round).toBe(3);
  });

  it('wraps to the next round after a null slot at the end of the order', () => {
    const next = chroniclesAdvanceCombatInitiative(
      restoredCombat([hero, goblin, null], 2),
      enemies,
    );
    expect(next.initiative.order.map(({ id }) => id)).toEqual(['matthias', 'goblin']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject(hero);
    expect(next.initiative.round).toBe(4);
  });

  it('prunes a leashed enemy even when the saved cursor points at null', () => {
    const state = {
      ...restoredCombat([
        hero,
        null,
        { kind: 'enemy', id: 'tobias', initiative: 8 },
        goblin,
      ], 1),
      mapId: 'swordhaven-sewers',
      x: 1,
      y: 15,
      tobiasHp: 5,
    };
    const next = chroniclesAdvanceCombatInitiative(state, [
      { id: 'tobias', hpKey: 'tobiasHp', x: 9, y: 17, ai: { engageRange: 2, attackReach: 1 } },
      { id: 'goblin', hpKey: 'goblinHp', x: 1, y: 14, ai: { engageRange: 1, attackReach: 1 } },
    ]);
    expect(next.phase).toBe('combat');
    expect(next.initiative.order.map(({ id }) => id)).toEqual(['matthias', 'goblin']);
    expect(chroniclesCurrentInitiativeActor(next.initiative)).toMatchObject(goblin);
    expect(next.initiative.round).toBe(3);
  });
});
