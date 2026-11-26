import { describe, expect, it } from 'vitest';
import { chroniclesLootNotice } from './chroniclesLootNotice.js';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('Chronicles visible loot receipts', () => {
  it('announces the actual object granted by an interaction, not the attempted label', () => {
    const before = { inventory: {}, turns: 0 };
    const after = { inventory: { sealed: { name: 'Carta sellada', quantity: 1 } }, turns: 1 };
    expect(chroniclesLootNotice(before, after, 'interact')).toMatchObject({
      kind: 'pickup', text: 'Encuentras: Carta sellada',
    });
    expect(chroniclesLootNotice(after, after, 'interact')).toBeNull();
  });

  it('shows actual numeric loot after defeating an ordinary enemy, with other inventory untouched', () => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
    const others = Object.fromEntries(chroniclesActiveEnemies(base)
      .filter((enemy) => enemy.id !== goblin.id).map((enemy) => [enemy.hpKey, 0]));
    const before = { ...base, ...others, x: 1, y: 4, direction: 2, runSeed: 'loot-receipt-test',
      [goblin.hpKey]: 1 };
    const resolved = chroniclesReduce(before, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    const gained = Number(resolved.inventory?.['crown-gold']?.quantity || 0)
      - Number(before.inventory?.['crown-gold']?.quantity || 0);
    if (gained > 0) {
      const notice = chroniclesLootNotice(before, resolved, { type: 'attack', memberId: 'matthias' });
      expect(notice.kind).toBe('loot');
      expect(notice.text).toContain(`${gained} monedas de oro`);
    } else {
      // A missed swing is not a guaranteed reward.
      expect(chroniclesLootNotice(before, resolved, { type: 'attack' })).toBeNull();
    }
  });


  it.each([
    ['sewers-dropped-purse', 5, []],
    ['sewers-contraband-crate', 6, ['2 × Poción de curación']],
    ['sewers-old-bones', 4, []],
    ['sewers-smuggler-stash', 10, ['Daga de bronce']],
  ])('announces a real sewer treasure and does not repeat its reward: %s', (id, gold, items) => {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const treasure = chroniclesMapById('swordhaven-sewers').treasures.find((entry) => entry.id === id);
    expect(treasure).toBeDefined();
    const before = {
      ...base, x: treasure.x, y: treasure.y,
      ...(id === 'sewers-smuggler-stash' ? { sewersSmugglerHp: 0 } : {}),
    };
    const after = chroniclesReduce(before, 'interact');
    const notice = chroniclesLootNotice(before, after, 'interact');
    expect(notice).toMatchObject({ kind: 'pickup' });
    expect(notice.text).toContain(`${gold} monedas de oro`);
    for (const item of items) expect(notice.text).toContain(item);
    const repeated = chroniclesReduce(after, 'interact');
    expect(chroniclesLootNotice(after, repeated, 'interact')).toBeNull();
  });

  it('deduplicates by the actual inventory delta and never invents a drop on misses', () => {
    const before = { inventory: { 'crown-gold': { quantity: 8 }, potion: { name: 'Poción', quantity: 2 } } };
    const gained = { inventory: { 'crown-gold': { quantity: 11 }, potion: { name: 'Poción', quantity: 3 } } };
    expect(chroniclesLootNotice(before, gained, { type: 'volley' })).toMatchObject({
      kind: 'loot', text: 'Botín: 3 monedas de oro · Poción',
    });
    expect(chroniclesLootNotice(before, { inventory: before.inventory }, 'volley')).toBeNull();
    expect(chroniclesLootNotice(before, gained, { type: 'shop-buy' })).toBeNull();
    expect(chroniclesLootNotice(before, gained, { type: 'transfer-item' })).toBeNull();
  });

  it('uses the real localized names and quantities for three or more distinct objects', () => {
    const next = { inventory: {
      a: { name: 'Llave oxidada', quantity: 1 }, b: { name: 'Poción', quantity: 2 },
      c: { name: 'Gema azul', quantity: 1 }, d: { name: 'Pergamino', quantity: 1 },
    } };
    expect(chroniclesLootNotice({ inventory: {} }, next, 'interact').text)
      .toBe('Encuentras: Llave oxidada · 2 × Poción · Gema azul · +1 más');
  });
});

describe('MM3 gear pickup ownership receipts', () => {
  const party = [{ id: 'a', name: 'Alicia' }, { id: 'b', name: 'Bruno' }];
  const state = { combatRules: 'mm3', party, inventory: {}, bagOwners: {} };
  const sword = { id: 'bronze-sword', name: 'Espada de bronce', quantity: 1 };
  it('names only the proven recipient of new gear and never assigns pooled gold', () => {
    const after = { ...state, inventory: { 'bronze-sword': sword, 'crown-gold': { quantity: 3 } },
      bagOwners: { b: { 'bronze-sword': 1 } } };
    const original = JSON.stringify(after);
    const receipt = chroniclesLootNotice(state, after, 'interact');
    expect(receipt.text).toBe('Encuentras: Espada de bronce (mochila de Bruno) · 3 monedas de oro');
    expect(receipt.entries[0].owner).toEqual({ memberId: 'b', name: 'Bruno' });
    expect(receipt.entries[1]).not.toHaveProperty('owner');
    expect(JSON.stringify(after)).toBe(original);
  });
  it('uses the canonical inferred bag for ownerless loot, not an assumed first hero', () => {
    const before = { ...state, inventory: { potion: { quantity: 1 } }, bagOwners: { a: { potion: 1 } } };
    const after = { ...before, inventory: { ...before.inventory, 'bronze-sword': sword } };
    expect(chroniclesLootNotice(before, after, 'attack').entries[0].owner)
      .toEqual({ memberId: 'b', name: 'Bruno' });
  });
  it('omits an ambiguous recipient for split or reallocated gear', () => {
    const two = { ...sword, quantity: 2 };
    const split = { ...state, inventory: { 'bronze-sword': two }, bagOwners: { a: { 'bronze-sword': 1 }, b: { 'bronze-sword': 1 } } };
    expect(chroniclesLootNotice(state, split, 'interact').entries[0]).not.toHaveProperty('owner');
    const before = { ...state, inventory: { 'bronze-sword': sword }, bagOwners: { a: { 'bronze-sword': 1 } } };
    const after = { ...state, inventory: { 'bronze-sword': two }, bagOwners: { b: { 'bronze-sword': 2 } } };
    expect(chroniclesLootNotice(before, after, 'attack').entries[0]).not.toHaveProperty('owner');
    expect(chroniclesLootNotice(state, { ...split, combatRules: 'tactics' }, 'interact').entries[0]).not.toHaveProperty('owner');
  });
  it('does not fabricate loot from coerced malformed quantities', () => {
    for (const quantity of [true, [1], 1.5, Infinity, 10000, '']) {
      expect(chroniclesLootNotice(state, { ...state, inventory: { 'bronze-sword': { ...sword, quantity } } }, 'interact')).toBeNull();
    }
  });
});
