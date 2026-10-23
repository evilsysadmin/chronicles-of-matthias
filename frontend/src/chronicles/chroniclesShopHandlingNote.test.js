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

  it('does not promise shield accuracy or parry during two-handed bow and crossbow shots', () => {
    for (const id of ['wooden-bow', 'wooden-longbow', 'brass-crossbow']) {
      expect(CHRONICLES_EQUIPMENT[id].slot).toBe('missile');
      expect(CHRONICLES_EQUIPMENT[id].twoHanded).toBe(true);
      expect(note(id)).toContain('no aporta armadura ni acierto');
      expect(note(id)).toContain('represalia inmediata');
    }
    expect(CHRONICLES_EQUIPMENT['brass-sling'].twoHanded).toBe(false);
    expect(note('brass-sling')).toContain('mantiene las ventajas del escudo');
    expect(note('bronze-shield')).toContain('no aporta armadura ni acierto');
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
