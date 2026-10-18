import { describe, expect, it } from 'vitest';
import { chroniclesCommonLoot, createChroniclesState } from '../chroniclesOfMatthias.js';
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
