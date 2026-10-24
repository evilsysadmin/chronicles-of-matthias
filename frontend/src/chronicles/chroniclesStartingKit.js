// A real (but modest) MM3-style starting company. Grant only when the
// authoritative server reports a pristine first-person run (worldVersion 0).
// Once a checkpoint exists, its inventory and equipped slots are authoritative.
import { CHRONICLES_GOLD_ITEM_ID } from './chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT, chroniclesMemberCanEquip } from './chroniclesEquipment.js';

export const CHRONICLES_STARTING_GOLD = 40;

export const CHRONICLES_STARTER_WEAPON_BY_CLASS = Object.freeze({
  knight: 'bronze-sword',
  paladin: 'bronze-mace',
  cleric: 'bronze-mace',
  archer: 'bronze-dagger',
  sorcerer: 'wooden-staff',
  robber: 'bronze-dagger',
  ninja: 'bronze-dagger',
  barbarian: 'bronze-axe',
  druid: 'wooden-staff',
  ranger: 'bronze-sword',
});

// Standard newcomers start in leather. The sorcerer is the sole MM3 class
// whose armor ceiling is padded; never silently equip illegal leather.
export const CHRONICLES_STARTER_ARMOR_ID = 'leather-leather';
export const CHRONICLES_STARTER_PADDED_ARMOR_ID = 'leather-padded';

// MM3 heroes carry a missile weapon beside the melee one (S · disparar).
export const CHRONICLES_STARTER_MISSILE_BY_CLASS = Object.freeze({
  archer: 'wooden-bow',
  ranger: 'wooden-bow',
});

export function chroniclesApplyStartingKit(state, run) {
  if (state?.combatRules !== 'mm3' || !Array.isArray(state.party)
    || run?.worldVersion !== 0 || (run.runStatus || run.status || 'active') !== 'active'
    || Object.keys(run?.worldFlags || {}).length
    || Object.keys(run?.inventory || {}).length
    || (run?.claimedRewards || []).length || (run?.consumedContentIds || []).length
    || Object.keys(state.inventory || {}).length || Object.keys(state.equipment || {}).length) {
    return state;
  }

  const equipment = {};
  for (const member of state.party) {
    const leather = CHRONICLES_EQUIPMENT[CHRONICLES_STARTER_ARMOR_ID];
    const padded = CHRONICLES_EQUIPMENT[CHRONICLES_STARTER_PADDED_ARMOR_ID];
    const armor = chroniclesMemberCanEquip(member, leather) ? leather
      : chroniclesMemberCanEquip(member, padded) ? padded : null;
    if (armor) equipment[member.id] = { ...equipment[member.id], armor: armor.id };
    for (const [slot, table] of [['weapon', CHRONICLES_STARTER_WEAPON_BY_CLASS], ['missile', CHRONICLES_STARTER_MISSILE_BY_CLASS]]) {
      const item = CHRONICLES_EQUIPMENT[table[member.mm3?.classId]];
      if (!item || item.slot !== slot || !chroniclesMemberCanEquip(member, item)) continue;
      equipment[member.id] = { ...equipment[member.id], [slot]: item.id };
    }
  }

  return {
    ...state,
    equipment,
    inventory: {
      [CHRONICLES_GOLD_ITEM_ID]: {
        id: CHRONICLES_GOLD_ITEM_ID,
        name: 'Oro',
        description: 'Monedas de la bolsa común de la compañía.',
        quantity: CHRONICLES_STARTING_GOLD,
      },
    },
  };
}
