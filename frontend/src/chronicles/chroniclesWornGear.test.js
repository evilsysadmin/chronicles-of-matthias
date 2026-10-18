import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesWornGear } from './chroniclesWornGear.js';

const firstOf = (predicate) => Object.values(CHRONICLES_EQUIPMENT).find(predicate);

describe('Chronicles worn gear', () => {
  const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const knight = base.party.find((member) => member.id === 'knight');

  it('shows three slots, empty ones as «Sin equipar»', () => {
    const gear = chroniclesWornGear({ ...base, equipment: {} }, knight.id);
    expect(gear.map((slot) => slot.slot)).toEqual(['weapon', 'armor', 'shield']);
    expect(gear.every((slot) => slot.empty && slot.name === 'Sin equipar')).toBe(true);
  });

  it('describes what an equipped bow adds and that it takes both hands', () => {
    const bow = firstOf((item) => item.slot === 'weapon' && item.twoHanded && item.reach > 1 && item.allowedMembers?.includes('knight'));
    const gear = chroniclesWornGear({ ...base, equipment: { knight: { weapon: bow.id } } }, knight.id);
    expect(gear[0]).toMatchObject({ name: bow.name, glyph: '➶', empty: false });
    expect(gear[0].effects).toContain(`Alcance ${bow.reach}`);
    expect(gear[0].effects).toContain('A dos manos');
    expect(gear[2]).toMatchObject({ name: 'Manos ocupadas', empty: true });
  });
});
