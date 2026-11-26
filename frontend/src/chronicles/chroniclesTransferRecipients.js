import { CHRONICLES_EQUIPMENT, chroniclesEquippedItem, chroniclesMemberCanEquip } from './chroniclesEquipment.js';

// A handoff is a backpack transfer, not an equip command. Compatibility
// is advisory: anyone may carry gear even if they cannot wield it.
export function chroniclesTransferGearRecipients(state, sourceId, itemId) {
  if (state?.combatRules !== 'mm3' || !Object.hasOwn(CHRONICLES_EQUIPMENT, itemId || '')) return [];
  const item = CHRONICLES_EQUIPMENT[itemId];
  return (state.party || []).filter(hero => hero.id !== sourceId).map(hero => {
    const status = !chroniclesMemberCanEquip(hero, item) ? 'incompatible'
      : !(hero.hp > 0) ? 'down'
      : item.slot === 'shield' && chroniclesEquippedItem(state, hero.id, 'weapon')?.twoHanded ? 'hands'
      : chroniclesEquippedItem(state, hero.id, item.slot)?.id === item.id ? 'equipped'
      : 'ready';
    return { memberId: hero.id, name: hero.name, status };
  });
}

const LABELS = Object.freeze({
  ready: 'Puede equiparlo',
  incompatible: 'Clase incompatible',
  down: 'Fuera de combate',
  hands: 'Necesita una mano libre',
  equipped: 'Ya lleva este equipo',
});

export function chroniclesTransferRecipientLabel(status) {
  return LABELS[status] || '';
}

export function chroniclesTransferGearHint(recipients) {
  if (!recipients.length) return '';
  const ready = recipients.filter(row => row.status === 'ready').map(row => row.name);
  return ready.length ? 'Pueden equiparlo: ' + ready.join(', ') + '.'
    : 'Ningún otro héroe puede equiparlo ahora.';
}
