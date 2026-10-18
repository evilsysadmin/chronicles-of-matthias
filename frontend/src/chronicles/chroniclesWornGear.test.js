import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesWornGear } from './chroniclesWornGear.js';

const firstOf = (predicate) => Object.values(CHRONICLES_EQUIPMENT).find(predicate);

describe('Chronicles worn gear', () => {
  const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const knight = base.party.find((member) => member.id === 'knight');

  it('shows four slots, empty ones as «Sin equipar»', () => {
    const gear = chroniclesWornGear({ ...base, equipment: {} }, knight.id);
    expect(gear.map((slot) => slot.slot)).toEqual(['weapon', 'missile', 'armor', 'shield']);
    expect(gear.every((slot) => slot.empty && slot.name === 'Sin equipar')).toBe(true);
  });

  it('puts a bow in the missile slot, which leaves the shield hand free', () => {
    const bow = firstOf((item) => item.slot === 'missile' && item.twoHanded && item.reach > 1 && item.allowedMembers?.includes('knight'));
    const gear = chroniclesWornGear({ ...base, equipment: { knight: { missile: bow.id } } }, knight.id);
    expect(gear[1]).toMatchObject({ name: bow.name, glyph: '➶', empty: false });
    expect(gear[1].effects).toContain(`Alcance ${bow.reach}`);
    expect(gear[1].effects).not.toContain('A dos manos');
    expect(gear[3]).toMatchObject({ name: 'Sin equipar', empty: true });
  });

  it('reads a bow saved in the old weapon slot as the missile weapon', () => {
    const bow = firstOf((item) => item.slot === 'missile' && item.allowedMembers?.includes('knight'));
    const gear = chroniclesWornGear({ ...base, equipment: { knight: { weapon: bow.id } } }, knight.id);
    expect(gear[0]).toMatchObject({ empty: true });
    expect(gear[1]).toMatchObject({ name: bow.name, empty: false });
  });

  it('a two-handed melee weapon still takes the shield hand', () => {
    const spear = firstOf((item) => item.slot === 'weapon' && item.twoHanded && item.allowedMembers?.includes('knight'));
    const gear = chroniclesWornGear({ ...base, equipment: { knight: { weapon: spear.id } } }, knight.id);
    expect(gear[3]).toMatchObject({ name: 'Manos ocupadas', empty: true });
  });
});
