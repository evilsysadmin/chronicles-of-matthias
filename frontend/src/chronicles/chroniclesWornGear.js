import { CHRONICLES_EQUIPMENT_SLOTS, chroniclesEquippedItem } from './chroniclesEquipment.js';

const SLOT_LABELS = Object.freeze({ weapon: 'Arma · A', missile: 'Proyectil · S', armor: 'Armadura', shield: 'Escudo' });
const SLOT_GLYPHS = Object.freeze({ weapon: '⚔', missile: '➶', armor: '⛊', shield: '⛨' });

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

// What an equipped item adds, in the words of the sheet.
function effects(item) {
  if (!item) return [];
  const lines = [];
  if (item.attackDamageBonus) lines.push(`Daño ${signed(item.attackDamageBonus)}`);
  if (item.toHitBonus) lines.push(`Acierto ${signed(item.toHitBonus)}`);
  if (item.armorClassBonus) lines.push(`CA ${signed(item.armorClassBonus)}`);
  if (Number(item.reach) > 1) lines.push(`Alcance ${item.reach}`);
  // A missile weapon never takes the shield hand (MM3).
  if (item.twoHanded && item.slot === 'weapon') lines.push('A dos manos');
  return lines;
}

// MM3's paper doll: one line per slot, at a glance.
export function chroniclesWornGear(state, memberId) {
  const weapon = chroniclesEquippedItem(state, memberId, 'weapon');
  return CHRONICLES_EQUIPMENT_SLOTS.map((slot) => {
    const item = chroniclesEquippedItem(state, memberId, slot);
    const blocked = slot === 'shield' && !item && Boolean(weapon?.twoHanded);
    return {
      slot,
      label: SLOT_LABELS[slot],
      glyph: SLOT_GLYPHS[slot],
      item,
      name: item?.name || (blocked ? 'Manos ocupadas' : 'Sin equipar'),
      effects: blocked ? ['El arma va a dos manos'] : effects(item),
      empty: !item,
    };
  });
}
