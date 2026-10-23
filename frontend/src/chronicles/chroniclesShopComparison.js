// Shop inspection is read-only: evaluate a hypothetical gear loadout against
// the exact same combat calculators used by the character sheet and battles.
// No inventory, gold, equipment or checkpoint changes occur here.
import { chroniclesPartyArmorClass, chroniclesPartyAttackStats, chroniclesUsesMM3Combat } from '../chroniclesOfMatthias.js';
import {
  chroniclesEquippedItem,
  chroniclesEquipmentBonuses,
  chroniclesMemberCanEquip,
} from './chroniclesEquipment.js';

const STAT_LABELS = Object.freeze({
  toHit: 'Acierto',
  damage: 'Daño',
  reach: 'Alcance',
  armorClass: 'Armadura (CA)',
  damageReduction: 'Reducción de daño',
});

function combatMetrics(state, memberId) {
  const attack = chroniclesPartyAttackStats(state, memberId);
  return {
    toHit: Number(attack.toHit || 0),
    damage: Number(attack.damage || 0),
    reach: Number(attack.reach || 0),
    armorClass: Number(chroniclesPartyArmorClass(state, memberId) || 0),
    damageReduction: Number(chroniclesEquipmentBonuses(state, memberId).damageReduction || 0),
  };
}

// A shot uses the dedicated missile loadout, not melee's attack metrics.
// Show the actual equipment modifiers (rather than inventing final to-hit
// numbers which may also depend on class, position or the target).
function missileEquipmentMetrics(state, memberId) {
  const bonus = chroniclesEquipmentBonuses(state, memberId, { mode: 'missile' });
  const equipped = chroniclesEquippedItem(state, memberId, 'missile');
  return {
    toHit: Number(bonus.toHitBonus || 0),
    damage: Number(bonus.attackDamageBonus || 0),
    reach: Number(equipped?.reach || 0),
  };
}

function previewEquipped(state, memberId, item, displacedShield) {
  const gear = { ...state.equipment?.[memberId], [item.slot]: item.id };
  if (displacedShield) delete gear.shield;
  return {
    ...state,
    equipment: { ...state.equipment, [memberId]: gear },
  };
}

export function chroniclesShopEquipmentComparisons(state, item) {
  if (!state || !item || !['weapon', 'missile', 'armor', 'shield'].includes(item.slot)) return [];

  return (state.party || []).map((member) => {
    const current = chroniclesEquippedItem(state, member.id, item.slot);
    const weapon = chroniclesEquippedItem(state, member.id, 'weapon');
    const canEquip = chroniclesMemberCanEquip(member, item);
    const shieldBlocked = item.slot === 'shield' && Boolean(weapon?.twoHanded);
    const eligible = canEquip && !shieldBlocked && member.hp > 0;
    const reason = !canEquip
      ? 'Su clase no puede equiparlo'
      : shieldBlocked
        ? 'Necesita quitar antes el arma a dos manos'
        : member.hp <= 0 ? 'Fuera de combate' : null;
    const alreadyEquipped = current?.id === item.id;
    const displacedShield = item.slot === 'weapon' && item.twoHanded
      ? chroniclesEquippedItem(state, member.id, 'shield')
      : null;
    if (!eligible || alreadyEquipped) {
      return { memberId: member.id, name: member.name, current, eligible, reason, alreadyEquipped, displacedShield: null, stats: [] };
    }

    const nextState = previewEquipped(state, member.id, item, displacedShield);
    const before = item.slot === 'missile' ? missileEquipmentMetrics(state, member.id) : combatMetrics(state, member.id);
    const after = item.slot === 'missile' ? missileEquipmentMetrics(nextState, member.id) : combatMetrics(nextState, member.id);
    // MM3 uses armor class to prevent a hit, not passive subtraction once
    // struck. Damage reduction is a legacy combat rule: never show a fake
    // reduction loss in a modern MM3 merchant comparison.
    const defenses = chroniclesUsesMM3Combat(state) ? ['armorClass'] : ['armorClass', 'damageReduction'];
    const keys = item.slot === 'weapon'
      ? ['toHit', 'damage', 'reach', ...(displacedShield ? defenses : [])]
      : item.slot === 'missile' ? ['toHit', 'damage', 'reach']
        : item.slot === 'shield' ? [...defenses, ...(after.toHit !== before.toHit ? ['toHit'] : [])]
          : item.slot === 'armor' ? [
              ...defenses,
              ...(chroniclesUsesMM3Combat(state) && after.toHit !== before.toHit ? ['toHit'] : []),
            ] : defenses;

    return {
      memberId: member.id,
      name: member.name,
      current,
      eligible,
      reason: null,
      alreadyEquipped: false,
      displacedShield,
      stats: keys.map((key) => ({
        key,
        label: item.slot === 'missile' && key !== 'reach' ? `${STAT_LABELS[key]} (bono)` : STAT_LABELS[key],
        before: before[key],
        after: after[key],
        delta: after[key] - before[key],
      })),
    };
  });
}
