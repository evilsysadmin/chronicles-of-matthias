import { chroniclesPartyAttackStats, chroniclesPartyArmorClass } from '../chroniclesOfMatthias.js';
import {
  CHRONICLES_EQUIPMENT,
  chroniclesEquippedItem,
  chroniclesMemberCanEquip,
  chroniclesNormalizeMemberEquipment,
} from './chroniclesEquipment.js';

const WEAPON_SLOTS = Object.freeze(['weapon', 'missile']);

export function chroniclesGearAttackModes(state, memberId) {
  return {
    weapon: chroniclesPartyAttackStats(state, memberId, 'melee'),
    missile: chroniclesPartyAttackStats(state, memberId, 'missile'),
  };
}

// Preview with the *same* actual combat/stat functions as the reducer. This
// is a read-only hypothetical loadout: inventory, saves and combat never
// change until the user explicitly presses Equipar. A two-handed melee weapon
// also puts away the shield, exactly as the real equip action does.
export function chroniclesGearSwapPreview(state, memberId, itemId) {
  const member = state?.party?.find((hero) => hero.id === memberId);
  const item = CHRONICLES_EQUIPMENT[itemId];
  if (state?.combatRules !== 'mm3' || !member || !item
    || !WEAPON_SLOTS.includes(item.slot) || !chroniclesMemberCanEquip(member, item)) return null;
  const before = chroniclesPartyAttackStats(state, memberId, item.slot === 'weapon' ? 'melee' : 'missile');
  const equipment = {
    ...chroniclesNormalizeMemberEquipment(state.equipment?.[memberId]),
    [item.slot]: item.id,
  };
  const displacedShield = item.slot === 'weapon' && item.twoHanded
    ? chroniclesEquippedItem(state, memberId, 'shield')
    : null;
  if (displacedShield) delete equipment.shield;
  const hypothetical = {
    ...state,
    equipment: { ...(state.equipment || {}), [memberId]: equipment },
  };
  const after = chroniclesPartyAttackStats(hypothetical, memberId, item.slot === 'weapon' ? 'melee' : 'missile');
  return {
    slot: item.slot,
    currentName: chroniclesEquippedItem(state, memberId, item.slot)?.name || 'Sin equipar',
    proposedName: item.name,
    before,
    after,
    delta: {
      damage: after.damage - before.damage,
      toHit: after.toHit - before.toHit,
      reach: after.reach - before.reach,
    },
    displacedShieldName: displacedShield?.name || null,
    armorClassDelta: displacedShield
      ? chroniclesPartyArmorClass(hypothetical, memberId) - chroniclesPartyArmorClass(state, memberId)
      : 0,
  };
}
