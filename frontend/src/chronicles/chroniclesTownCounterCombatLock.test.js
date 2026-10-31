import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const map = chroniclesMapById('swordhaven-first-book');

function company() {
  return chroniclesApplyContentEffects(
    createChroniclesState(map.id, null, { rules: 'mm3' }),
    [{ type: 'grant-gold', amount: 200 }],
  );
}

function staleCombatStates(state) {
  return [
    // A panel from exploration survives an encounter-starting callback.
    { ...state, phase: 'combat', initiative: { order: [{ kind: 'enemy', id: 'foe' }], cursor: 0 } },
    // A delayed action must also be rejected before the phase catches up.
    { ...state, initiative: { order: [{ kind: 'party', id: 'matthias' }], cursor: 0 } },
  ];
}

describe('MM3 counters cannot transact during initiative', () => {
  it('rejects stale shop purchases and sales without changing inventory or gold', () => {
    const open = chroniclesReduce({ ...company(), x: 7, y: 4 }, 'interact');
    expect(open.shop?.id).toBe('first-book-weaponsmith');
    const stocked = chroniclesApplyContentEffects(open, [
      { type: 'grant-item', itemId: 'brass-dagger', name: 'Daga de latón', quantity: 1 },
    ]);
    for (const action of [
      { type: 'shop-buy', itemId: 'brass-dagger' },
      { type: 'shop-sell', itemId: 'brass-dagger' },
    ]) {
      expect(chroniclesReduce(stocked, action)).not.toBe(stocked);
      for (const fighting of staleCombatStates(stocked)) {
        expect(chroniclesReduce(fighting, action)).toBe(fighting);
      }
    }
  });

  it('rejects stale inn rest and food purchases, including free combat healing', () => {
    const entry = map.interactables.find(({ id }) => id === 'first-book-healer');
    expect(entry).toBeTruthy();
    const open = chroniclesReduce({ ...company(), x: entry.x, y: entry.y }, 'interact');
    expect(open.inn?.id).toBe(entry.id);
    const wounded = {
      ...open,
      party: open.party.map((hero) => ({ ...hero, hp: Math.min(hero.hp, 1) })),
    };
    for (const action of [{ type: 'inn-rest' }, { type: 'inn-buy-food' }]) {
      expect(chroniclesReduce(wounded, action)).not.toBe(wounded);
      for (const fighting of staleCombatStates(wounded)) {
        expect(chroniclesReduce(fighting, action)).toBe(fighting);
      }
    }
  });

  it('rejects a stale guild membership purchase without blocking exploration', () => {
    const entry = map.interactables.find((item) => item.guild);
    expect(entry).toBeTruthy();
    const open = { ...company(), x: entry.x, y: entry.y, guild: { id: entry.id } };
    const action = { type: 'guild-join' };
    expect(chroniclesReduce(open, action)).not.toBe(open);
    for (const fighting of staleCombatStates(open)) {
      expect(chroniclesReduce(fighting, action)).toBe(fighting);
    }
  });
});
