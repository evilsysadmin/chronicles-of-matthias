import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesHitImpacts, chroniclesSplatScale } from './chroniclesHitSplats.js';

describe('Chronicles hit splats', () => {
  const base = createChroniclesState('swordhaven-sewers');
  const goblin = chroniclesMapById('swordhaven-sewers').enemies.find((enemy) => enemy.id === 'sewers-goblin-west');

  it('reports damage dealt to an enemy and taken by a hero', () => {
    const before = { ...base, [goblin.hpKey]: 4 };
    const hero = before.party[0];
    const after = {
      ...before,
      [goblin.hpKey]: 1,
      party: before.party.map((member) => member.id === hero.id ? { ...member, hp: member.hp - 2 } : member),
    };
    expect(chroniclesHitImpacts(before, after)).toEqual([
      { kind: 'party', id: hero.id, amount: 2, share: 2 / hero.maxHp },
      { kind: 'enemy', id: goblin.id, amount: 3, share: 3 / goblin.maxHp },
    ]);
  });

  it('ignores healing, unchanged states and map changes', () => {
    const hurt = { ...base, party: base.party.map((member) => ({ ...member, hp: 1 })) };
    expect(chroniclesHitImpacts(hurt, base)).toEqual([]);
    expect(chroniclesHitImpacts(base, base)).toEqual([]);
    expect(chroniclesHitImpacts(base, { ...hurt, mapId: 'swordhaven-first-book' })).toEqual([]);
  });

  it('grows with the share of life a blow takes', () => {
    expect(chroniclesSplatScale({ share: 0.05 })).toBeLessThan(chroniclesSplatScale({ share: 0.3 }));
    expect(chroniclesSplatScale({ share: 0.5 })).toBe(chroniclesSplatScale({ share: 1 }));
  });
});
