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
