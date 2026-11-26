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

// Armor and shields can affect both attack modes as well as effective CA.
// Use the actual combat calculators (including fatigue and temporary boons)
// rather than subtracting the two item-catalog bonuses. No equip action.
export function chroniclesDefenseSwapPreview(state, memberId, itemId) {
  const member = state?.party?.find(hero => hero.id === memberId);
  const item = CHRONICLES_EQUIPMENT[itemId];
  if (state?.combatRules !== 'mm3' || !member || !item
      || !['armor', 'shield'].includes(item.slot) || !chroniclesMemberCanEquip(member, item)) return null;
  if (item.slot === 'shield' && chroniclesEquippedItem(state, memberId, 'weapon')?.twoHanded) return null;
  const hypothetical = {
    ...state,
    equipment: { ...state.equipment, [memberId]: {
      ...chroniclesNormalizeMemberEquipment(state.equipment?.[memberId]), [item.slot]: item.id,
    } },
  };
  const metrics = source => {
    const melee = chroniclesPartyAttackStats(source, memberId, 'melee');
    const missile = chroniclesPartyAttackStats(source, memberId, 'missile');
    return { armorClass: chroniclesPartyArmorClass(source, memberId),
      meleeHit: melee.toHit, meleeDamage: melee.damage,
      missileHit: missile.toHit, missileDamage: missile.damage };
  };
  const before = metrics(state), after = metrics(hypothetical);
  const labels = { armorClass: 'CA efectiva', meleeHit: 'Acierto (A)', meleeDamage: 'Daño (A)',
    missileHit: 'Acierto (S)', missileDamage: 'Daño (S)' };
  return {
    currentName: chroniclesEquippedItem(state, memberId, item.slot)?.name || 'Sin equipar',
    proposedName: item.name,
    stats: Object.keys(labels).map(key => ({ key, label: labels[key],
      before: before[key], after: after[key], delta: after[key] - before[key] }))
      .filter(stat => stat.key === 'armorClass' || stat.delta !== 0),
  };
}
