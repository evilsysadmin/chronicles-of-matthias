import { describe, expect, it } from 'vitest';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesShopHandlingNote } from './chroniclesShopHandlingNote.js';

const note = (id, rules = 'mm3') => chroniclesShopHandlingNote(CHRONICLES_EQUIPMENT[id], rules);

describe('Chronicles merchant · actual equipment hand usage', () => {
  it('explains why a two-handed melee weapon stows the shield', () => {
    for (const id of ['wooden-staff', 'wooden-spear']) {
      expect(CHRONICLES_EQUIPMENT[id].twoHanded).toBe(true);
      expect(note(id)).toContain('escudo vuelve a la mochila');
    }
    expect(note('brass-dagger')).toBe('');
    expect(note('brass-sword')).toBe('');
  });

  it('describes independent bow/crossbow/sling and shield slots without fake penalties', () => {
    for (const id of ['wooden-bow', 'wooden-longbow', 'brass-crossbow', 'brass-sling']) {
      expect(CHRONICLES_EQUIPMENT[id].slot).toBe('missile');
      expect(note(id)).toContain('arma de mano y escudo a la vez');
      expect(note(id)).toContain('mantiene sus bonificaciones');
      expect(note(id)).not.toContain('no aporta armadura');
    }
    expect(note('bronze-shield')).toContain('arco, ballesta u honda');
    expect(note('bronze-shield')).toContain('arma cuerpo a cuerpo a dos manos');
  });

  it('does not invent MM3 handling rules for legacy or consumables', () => {
    expect(note('wooden-bow', 'legacy')).toBe('');
    expect(note('bronze-shield', 'legacy')).toBe('');
    expect(note('wooden-staff', 'legacy')).toContain('escudo vuelve a la mochila');
    expect(chroniclesShopHandlingNote(null)).toBe('');
    expect(chroniclesShopHandlingNote({ slot: 'consumable' })).toBe('');
    expect(note('leather-padded')).toBe('');
  });
});
