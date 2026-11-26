import { describe, expect, it } from 'vitest';
import { chroniclesCommonLoot, chroniclesReduce, createChroniclesState, chroniclesActiveEnemies } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('Chronicles · ordinary foes carry something', () => {
  const sewers = chroniclesMapById('swordhaven-sewers');
  const goblin = sewers.enemies.find((enemy) => enemy.id === 'sewers-goblin-west');
  const tobias = sewers.enemies.find((enemy) => enemy.id === 'sewers-smuggler');
  const state = { ...createChroniclesState('swordhaven-sewers'), runSeed: 'seed-a' };

  it('drops a few coins, the same ones on every reload', () => {
    const loot = chroniclesCommonLoot(state, goblin);
    expect(loot.gold).toBeGreaterThanOrEqual(1);
    expect(chroniclesCommonLoot({ ...state }, goblin)).toEqual(loot);
  });

  it('leaves named foes to their own authored rewards', () => {
    expect(chroniclesCommonLoot(state, tobias)).toBeNull();
  });

  it('sometimes adds a potion', () => {
    const potions = Array.from({ length: 200 }, (_, i) => chroniclesCommonLoot({ ...state, runSeed: `s${i}` }, goblin).potion);
    const share = potions.filter(Boolean).length / potions.length;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.3);
  });
});

describe('Common loot at the checkpoint inventory limit', () => {
  function potionKill() {
    const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const foes = chroniclesActiveEnemies(base);
    const goblin = foes.find(enemy => enemy.id === 'sewers-goblin-west');
    const before = { ...base, x: 1, y: 5, direction: 1,
      ...Object.fromEntries(foes.filter(enemy => enemy.id !== goblin.id).map(enemy => [enemy.hpKey, 0])),
      [goblin.hpKey]: 1, inventory: {} };
    for (let i = 0; i < 200; i++) {
      const state = { ...before, runSeed: 'capped-loot-' + i };
      const loot = chroniclesCommonLoot(state, goblin);
      if (!loot.potion) continue;
      const after = chroniclesReduce(state, { type: 'attack', memberId: 'matthias', mode: 'melee' });
      if (after[goblin.hpKey] === 0 && after.inventory?.['healing-potion']?.quantity === 1) {
        return { state, after, goblin, loot };
      }
    }
    throw new Error('Expected a real seeded goblin kill with a potion');
  }
  const stack = (id, quantity) => ({ id, name: id, quantity });

  it('does not claim gold that the full purse refused, while still receiving the potion', () => {
    const { state, after, goblin, loot } = potionKill();
    expect(after.inventory['crown-gold'].quantity).toBe(loot.gold);
    expect(after.message).toContain(`${loot.gold} monedas y una poción de curación`);
    const capped = { ...state, inventory: { 'crown-gold': stack('crown-gold', 9999) } };
    const next = chroniclesReduce(capped, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(next[goblin.hpKey]).toBe(0);
    expect(next.inventory['crown-gold'].quantity).toBe(9999);
    expect(next.inventory['healing-potion'].quantity).toBe(1);
    expect(next.message).toContain('Lleva encima una poción de curación.');
    expect(next.message).not.toContain('monedas');
    expect(next.message).toContain('no cabe en el inventario');
  });

  it('never overflows a full potion stack or announces unavailable loot', () => {
    const { state, goblin } = potionKill();
    const before = { ...state, inventory: {
      'crown-gold': stack('crown-gold', 9999),
      'healing-potion': stack('healing-potion', 9999),
    } };
    const next = chroniclesReduce(before, { type: 'attack', memberId: 'matthias', mode: 'melee' });
    expect(next[goblin.hpKey]).toBe(0);
    expect(next.inventory).toEqual(before.inventory);
    expect(next.message).not.toContain('Lleva encima');
    expect(next.message).toContain('no cabe en el inventario');
  });
});
