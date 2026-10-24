import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesShopEquipmentComparisons } from './chroniclesShopComparison.js';
import { chroniclesCompactShopComparisonGroups } from './chroniclesShopCompactComparison.js';

const member = (name, { delta = -1, from = 4, eligible = true, reason = null, shield = null } = {}) => ({
  memberId: name, name, eligible, reason, alreadyEquipped: false,
  displacedShield: shield ? { name: shield } : null,
  stats: eligible ? [{ key: 'armorClass', label: 'Armadura (CA)', before: from, after: from + delta, delta }] : [],
});

describe('Compact mobile shop comparison', () => {
  it('groups identical real deltas even when original absolute scores differ', () => {
    const groups = chroniclesCompactShopComparisonGroups([
      member('Matthias', { from: 5 }),
      member('Hildegard', { from: 8 }),
      member('Aziz', { from: 3 }),
      member('Faust', { from: 4 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].names).toEqual(['Matthias', 'Hildegard', 'Aziz', 'Faust']);
    expect(groups[0].changes).toEqual([{ key: 'armorClass', label: 'Armadura (CA)', delta: -1 }]);
  });

  it('never coalesces opposite outcomes, restrictions, already-equipped or shield losses', () => {
    const groups = chroniclesCompactShopComparisonGroups([
      member('Matthias', { delta: 1 }),
      member('Hildegard', { delta: -1 }),
      member('Aziz', { eligible: false, reason: 'Su clase no puede equiparlo' }),
      member('Faust', { eligible: false, reason: 'Fuera de combate' }),
      member('Soldado', { delta: 1, shield: 'Escudo de latón' }),
      { ...member('Veterano'), alreadyEquipped: true, stats: [] },
    ]);
    expect(groups).toHaveLength(6);
    expect(groups.map(({ names }) => names)).toEqual([
      ['Matthias'], ['Hildegard'], ['Aziz'], ['Faust'], ['Soldado'], ['Veterano'],
    ]);
    expect(groups[4].displacedShieldName).toBe('Escudo de latón');
    expect(groups[2].reason).toBe('Su clase no puede equiparlo');
  });

  it('compact groups retain every hero and the computed deltas from the MM3 engine', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    for (const id of ['brass-scale', 'wooden-shield', 'brass-dagger', 'wooden-longbow']) {
      const item = CHRONICLES_EQUIPMENT[id];
      const source = chroniclesShopEquipmentComparisons(state, item);
      const grouped = chroniclesCompactShopComparisonGroups(source);
      const names = grouped.flatMap(({ names }) => names);
      expect([...names].sort()).toEqual(source.map(({ name }) => name).sort());
      for (const group of grouped) {
        for (const name of group.names) {
          const hero = source.find((person) => person.name === name);
          expect(group.eligible).toBe(hero.eligible);
          expect(group.reason || null).toBe(hero.reason || null);
          expect(group.alreadyEquipped).toBe(hero.alreadyEquipped);
          expect(group.displacedShieldName).toBe(hero.displacedShield?.name || null);
          expect(group.changes.map(({ key, delta }) => [key, delta])).toEqual(
            hero.stats.filter((stat) => stat.delta !== 0).map(({ key, delta }) => [key, delta]),
          );
        }
      }
    }
  });
});
