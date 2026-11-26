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

  it.each([undefined, null, '', ' ', true, [0], NaN, Infinity, -Infinity, {}])(
    'does not invent damage from missing or malformed HP %s', invalid => {
      const before = { ...base, [goblin.hpKey]: 4 };
      const hero = before.party[0];
      const after = { ...before, [goblin.hpKey]: invalid,
        party: before.party.map(member => member.id === hero.id ? { ...member, hp: invalid } : member) };
      expect(chroniclesHitImpacts(before, after)).toEqual([]);
      expect(chroniclesHitImpacts(after, before)).toEqual([]);
    },
  );

  it('retains real lethal hits, numeric legacy HP and bounded overkill', () => {
    const hero = base.party[0];
    const before = { ...base, [goblin.hpKey]: '4',
      party: base.party.map(member => member.id === hero.id ? { ...member, hp: '3' } : member) };
    const after = { ...before, [goblin.hpKey]: -5,
      party: before.party.map(member => member.id === hero.id ? { ...member, hp: 0 } : member) };
    expect(chroniclesHitImpacts(before, after)).toEqual([
      { kind: 'party', id: hero.id, amount: 3, share: Math.min(1, 3 / hero.maxHp) },
      { kind: 'enemy', id: goblin.id, amount: 4, share: Math.min(1, 4 / goblin.maxHp) },
    ]);
  });

  it('ignores new expeditions on the same map and duplicate restored party entries', () => {
    const hero = base.party[0];
    const before = { ...base, runSeed: 'first', [goblin.hpKey]: 4 };
    const hurt = { ...hero, hp: hero.hp - 1 };
    const after = { ...before, [goblin.hpKey]: 3,
      party: [null, hurt, hurt, ...before.party.slice(1)] };
    expect(chroniclesHitImpacts(before, { ...after, runSeed: 'second' })).toEqual([]);
    expect(chroniclesHitImpacts(before, after).filter(impact => impact.kind === 'party'))
      .toEqual([{ kind: 'party', id: hero.id, amount: 1, share: 1 / hero.maxHp }]);
  });

  it('grows with the share of life a blow takes', () => {
    expect(chroniclesSplatScale({ share: 0.05 })).toBeLessThan(chroniclesSplatScale({ share: 0.3 }));
    expect(chroniclesSplatScale({ share: 0.5 })).toBe(chroniclesSplatScale({ share: 1 }));
    // ~15% reduction on both portrait and enemy: numeric damage remains legible.
    expect(chroniclesSplatScale({ share: 0 })).toBeCloseTo(0.55 * 0.85);
    expect(chroniclesSplatScale({ share: 0.5 })).toBeCloseTo(1.15 * 0.85);
  });
});
