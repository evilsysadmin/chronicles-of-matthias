// First Book equipment is a party-run possession, never a passive bonus
// from the bag. Wearing/holding an item removes exactly one copy from the
// shared inventory; unequipping returns it. All mutations are checkpointed.
// MM3-style item materials: material changes combat and merchant value,
// not merely the name. Canonical values follow the MM3 materials tables.
// Ivory is an authored-world extension, not an original MM3 material row.
import { CHRONICLES_MM3_ARMOR_TIERS, chroniclesMM3Class } from './chroniclesMM3Rules.js';

export const CHRONICLES_ITEM_MATERIALS = Object.freeze({
  // Starter junk. Wood and brass sit below bronze as in MM3's ladder; their
  // exact canonical rows were not verifiable, so they are marked approximate.
  wooden: Object.freeze({ name: 'madera', toHit: -1, damage: -3, armorClass: 0, valueMultiplier: 0.2, tier: 0, approximate: true }),
  brass: Object.freeze({ name: 'latón', toHit: 1, damage: -2, armorClass: 0, valueMultiplier: 0.5, tier: 0, approximate: true }),
  leather: Object.freeze({ name: 'cuero', toHit: -4, damage: -6, armorClass: 0, valueMultiplier: 0.25, tier: 0 }),
  bronze: Object.freeze({ name: 'bronce', toHit: 2, damage: -2, armorClass: -1, valueMultiplier: 0.75, tier: 1 }),
  iron: Object.freeze({ name: 'hierro', toHit: 1, damage: 2, armorClass: 1, valueMultiplier: 2, tier: 2 }),
  silver: Object.freeze({ name: 'plata', toHit: 2, damage: 4, armorClass: 2, valueMultiplier: 5, tier: 2 }),
  steel: Object.freeze({ name: 'acero', toHit: 3, damage: 6, armorClass: 4, valueMultiplier: 10, tier: 3 }),
  pearl: Object.freeze({ name: 'perla', toHit: 2, damage: 2, armorClass: 2, valueMultiplier: 20, tier: 2 }),
  // The user-requested ivory necklace family belongs to our extension catalog.
  ivory: Object.freeze({ name: 'marfil', toHit: 1, damage: 1, armorClass: 1, valueMultiplier: 3, tier: 2, extension: true }),
});

function authoredEquipment(spec) {
  const material = CHRONICLES_ITEM_MATERIALS[spec.materialId];
  if (!material) throw new Error(`Unknown Chronicles equipment material: ${spec.materialId}`);
  const weapon = spec.slot === 'weapon' || spec.slot === 'missile';
  return Object.freeze({
    ...spec,
    // Catalog weapons apply half the MM3 material damage: this world's base
    // damage is a few points, so the raw table (steel +6) would one-shot.
    attackDamageBonus: spec.baseDamageBonus
      + (weapon ? Math.round(material.damage * (spec.materialDamageScale ?? 1)) : 0),
    // Existing First Book mitigation is an interim, deterministic defense
    // effect. MM3's material armorClass remains explicit for proper AC later.
    damageReduction: spec.baseDamageReduction,
    // A shield's bulk or agility changes real attack accuracy. Armor itself
    // has no hidden offensive modifier; this is shared by melee and missiles.
    toHitBonus: weapon
      ? material.toHit + Number(spec.baseToHitBonus || 0)
      : spec.slot === 'shield' ? Number(spec.shieldToHitBonus || 0)
        : spec.slot === 'armor' ? Number(spec.armorToHitBonus || 0) : 0,
    // MM armor class: the armor type's own AC plus its material.
    armorClassBonus: !weapon ? Math.max(0, Number(spec.baseArmorClass || 0) + material.armorClass) : 0,
    price: Math.max(1, Math.round(spec.basePrice * material.valueMultiplier)),
    // Progression tier: 0 starter junk (wood, brass, leather), 1 bronze,
    // 2 iron/silver/ivory/pearl, 3 steel. Towns and loot tables gate by it.
    tier: material.tier,
  });
}

const LEGACY_FRONT = Object.freeze(['matthias', 'rook']);
const LEGACY_MARTIAL = Object.freeze(['matthias', 'rook', 'knight']);
const LEGACY_ALL = Object.freeze(['matthias', 'rook', 'bishop', 'knight']);

// MM3-style base items. Prices are scaled to this world's purses (a side
// quest pays 8–18 oro); the material multiplier does the rest, so steel is
// an aspiration and bronze is what a fresh company can afford.
// The starter bandit has ~4 HP and d20 enemy AC; one bonus damage can be
// an entire attack round. Each family therefore trades precision, damage,
 // reach, off-hand safety and cost using EXISTING combat stats only.
const BASE_WEAPONS = Object.freeze({
  dagger: { name: 'Daga', family: 'dagger', basePrice: 2, baseDamageBonus: 1, baseToHitBonus: 2, allowed: LEGACY_ALL },
  staff: { name: 'Bastón', family: 'staff', basePrice: 3, baseDamageBonus: 1, baseToHitBonus: 1, reach: 2, twoHanded: true, allowed: LEGACY_ALL },
  mace: { name: 'Maza', family: 'mace', basePrice: 4, baseDamageBonus: 2, allowed: LEGACY_ALL },
  spear: { name: 'Lanza', family: 'spear', basePrice: 5, baseDamageBonus: 2, reach: 2, twoHanded: true, allowed: LEGACY_MARTIAL },
  sword: { name: 'Espada', family: 'sword', basePrice: 6, baseDamageBonus: 2, baseToHitBonus: 1, allowed: LEGACY_MARTIAL },
  axe: { name: 'Hacha', family: 'axe', basePrice: 7, baseDamageBonus: 3, baseToHitBonus: -1, allowed: LEGACY_MARTIAL },
  bow: { name: 'Arco corto', family: 'bow', basePrice: 8, baseDamageBonus: 3, twoHanded: true, reach: 3, allowed: LEGACY_ALL },
  // Ranged arms of Terra's third wave: the long bow reaches farthest, the
  // crossbow hits harder, the sling is a one-hand option for slingers who
  // keep a shield (barbarians, druids, robbers). Reach is paid in damage: a
  // steel crossbow hits like a steel axe, a long bow like a sword, and both
  // take the shield hand (campaign bot, 2026-10: at axe+2 every hero
  // carried a crossbow).
  longbow: { name: 'Arco largo', family: 'bow', basePrice: 14, baseDamageBonus: 2, twoHanded: true, reach: 4, allowed: ['knight'] },
  crossbow: { name: 'Ballesta', family: 'crossbow', basePrice: 12, baseDamageBonus: 3, twoHanded: true, reach: 3, allowed: ['knight'] },
  sling: { name: 'Honda', family: 'sling', basePrice: 2, baseDamageBonus: 1, baseToHitBonus: 2, reach: 2, allowed: LEGACY_ALL },
});

// First Book defensive choices: CA prevents an MM3 hit (5 percentage
// points per AC in the unsaturated d20 window); it does NOT subtract damage.
// Every paid shield upgrade must earn its price in defense or aim. The old
// brass +1 CA / -1 aim vs wood was a trap at low level; more costly iron/steel
// repeated it. These authored profiles are NOT literal MM3 material stats.
// Ivory is a deliberate agile sidegrade (less guard than iron, more aim).
export const CHRONICLES_SHIELD_PROFILES = Object.freeze({
  wooden: Object.freeze({ armorClass: 1, toHit: 0 }), // budget protection
  brass: Object.freeze({ armorClass: 2, toHit: 0 }), // +1 CA without an aim tax
  bronze: Object.freeze({ armorClass: 2, toHit: 1 }), // better handling
  iron: Object.freeze({ armorClass: 3, toHit: 1 }), // stronger physical guard
  ivory: Object.freeze({ armorClass: 2, toHit: 2 }), // precision sidegrade
  silver: Object.freeze({ armorClass: 3, toHit: 2 }), // precision and guard
  steel: Object.freeze({ armorClass: 4, toHit: 2 }), // expensive top-tier guard
});

// Campaign AC progression: MM3's literal bronze material modifier (-1)
// made bronze armor *more expensive and strictly weaker* than brass armor
// of the same type. Keep canonical CHRONICLES_ITEM_MATERIALS unchanged for
// non-armor consumers; the RPG uses an authored, monotone protection ladder.
// This does NOT change shield (separate profiles) or weapon material bonuses.
export const CHRONICLES_ARMOR_MATERIAL_AC = Object.freeze({
  leather: 0,
  brass: 0,
  bronze: 1,
  iron: 2,
  silver: 3,
  steel: 5,
});

const BASE_ARMORS = Object.freeze({
  // Lighter cloth armor trades 1 CA for +1 precision against leather.
  // This is a real bonus to the existing hit formula, not fictitious speed.
  padded: { name: 'Gambesón', armorType: 'padded', basePrice: 6, baseArmorClass: 1, baseDamageReduction: 1, baseToHitBonus: 1, allowed: LEGACY_ALL },
  leather: { name: 'Coraza', armorType: 'leather', basePrice: 12, baseArmorClass: 2, baseDamageReduction: 1, allowed: LEGACY_ALL },
  scale: { name: 'Cota de escamas', armorType: 'scale', basePrice: 14, baseArmorClass: 3, baseDamageReduction: 1, allowed: LEGACY_FRONT },
  ring: { name: 'Cota de anillas', armorType: 'ring', basePrice: 18, baseArmorClass: 4, baseDamageReduction: 2, allowed: LEGACY_FRONT },
  chain: { name: 'Cota de malla', armorType: 'chain', basePrice: 24, baseArmorClass: 5, baseDamageReduction: 2, allowed: LEGACY_FRONT },
  splint: { name: 'Armadura de bandas', armorType: 'splint', basePrice: 32, baseArmorClass: 6, baseDamageReduction: 2, allowed: LEGACY_FRONT },
  plate: { name: 'Armadura de placas', armorType: 'plate', basePrice: 45, baseArmorClass: 7, baseDamageReduction: 3, allowed: LEGACY_FRONT },
});

// Which materials each base item is forged in. Leather only makes soft
// armour; ivory (our extension) is carved into daggers, staves and shields.
const WEAPON_MATERIALS = Object.freeze(['brass', 'bronze', 'iron', 'silver', 'steel']);
// Wood makes staves, clubs (wooden maces) and spears; ivory is carved.
const WOODEN_WEAPONS = Object.freeze(['staff', 'mace', 'spear', 'bow', 'longbow', 'sling']);
// A long bow is wood with metal-shod limbs and arrows: «arco largo de acero».
const SHOD_BOW_MATERIALS = Object.freeze(['bronze', 'iron', 'silver', 'steel']);
// A sling's material is its shot: lead-grey brass, bronze or iron balls.
const SLING_MATERIALS = Object.freeze(['brass', 'bronze', 'iron']);
const CARVED_MATERIALS = Object.freeze(['ivory']);
const SOFT_ARMOR_MATERIALS = Object.freeze(['leather', 'bronze', 'iron', 'steel']);
const METAL_ARMOR_MATERIALS = Object.freeze(['brass', 'bronze', 'iron', 'silver', 'steel']);
const SHIELD_MATERIALS = Object.freeze(['wooden', 'brass', 'bronze', 'iron', 'silver', 'steel', 'ivory']);

// «Espada de acero», «Bastón de marfil»: Spanish material phrases are
// genderless, so the base name always goes first.
function materialName(materialId) {
  return CHRONICLES_ITEM_MATERIALS[materialId].name;
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

// MM3 carries one melee and one missile slot. Two-handed bows/crossbows
// remain equipped alongside a shield, but shield bonuses are suspended
// while firing; slings use one hand and preserve the shield's benefits.
export const CHRONICLES_MISSILE_FAMILIES = Object.freeze(['bow', 'crossbow', 'sling']);

function weaponItem(baseId, materialId) {
  const base = BASE_WEAPONS[baseId];
  const slot = CHRONICLES_MISSILE_FAMILIES.includes(base.family) ? 'missile' : 'weapon';
  const material = CHRONICLES_ITEM_MATERIALS[materialId];
  // Prevent universally dominated gear: ivory carving buys precision, a
  // stone sling trades damage for accuracy, silver dagger costs more than
  // an iron sword at the same damage, but retains its superior finesse.
  const damageBase = base.baseDamageBonus
    + (baseId === 'sling' && materialId === 'wooden' ? 1 : 0);
  const aimBase = Number(base.baseToHitBonus || 0) + (materialId === 'ivory' ? 1 : 0);
  const damage = damageBase + Math.round(material.damage / 2);
  const toHit = material.toHit + aimBase;
  return authoredEquipment({
    id: `${materialId}-${baseId}`, name: `${base.name} de ${materialName(materialId)}`, slot,
    baseItemId: baseId, materialId,
    basePrice: base.basePrice + (baseId === 'dagger' && materialId === 'silver' ? 1 : 0),
    baseDamageBonus: damageBase, baseDamageReduction: 0, materialDamageScale: 0.5,
    baseToHitBonus: aimBase,
    weaponFamily: base.family, twoHanded: Boolean(base.twoHanded),
    reach: Number(base.reach || 1),
    allowedMembers: base.allowed,
    description: `${base.name}${slot === 'missile' ? ' · proyectil' : base.twoHanded ? ' a dos manos' : ''}${base.reach > 1 ? ` · alcance ${base.reach}` : ''} · acierto ${signed(toHit)}, daño ${signed(damage)}.`,
  });
}

function armorItem(baseId, materialId) {
  const base = BASE_ARMORS[baseId];
  const material = CHRONICLES_ITEM_MATERIALS[materialId];
  const protection = CHRONICLES_ARMOR_MATERIAL_AC[materialId];
  if (!Number.isInteger(protection)) throw new Error(`Unknown armor material: ${materialId}`);
  const armorClass = base.baseArmorClass + protection;
  return authoredEquipment({
    id: `${materialId}-${baseId}`, name: `${base.name} de ${materialName(materialId)}`, slot: 'armor',
    baseItemId: baseId, materialId,
    // The material multiplier rounded bronze leather to 9g, where Odo's
    // 9g guard vest had the same CA and strictly more aim for every class.
    basePrice: base.basePrice - (baseId === 'leather' && materialId === 'bronze' ? 1 : 0),
    baseDamageBonus: 0, baseDamageReduction: base.baseDamageReduction,
    // authoredEquipment adds the literal material AC; cancel that literal
    // only for body armor, replacing it with the progression value above.
    armorType: base.armorType,
    baseArmorClass: armorClass - material.armorClass,
    armorToHitBonus: Number(base.baseToHitBonus || 0),
    allowedMembers: base.allowed,
    description: `${base.name} · armadura +${armorClass}${base.baseToHitBonus ? `, acierto +${base.baseToHitBonus}` : ''}.`,
  });
}

function shieldItem(materialId) {
  const profile = CHRONICLES_SHIELD_PROFILES[materialId];
  if (!profile) throw new Error(`Unknown shield profile: ${materialId}`);
  return authoredEquipment({
    id: `${materialId}-shield`, name: `Escudo de ${materialName(materialId)}`, slot: 'shield',
    baseItemId: 'shield', materialId, basePrice: 8,
    baseDamageBonus: 0, baseDamageReduction: 1,
    // authoredEquipment adds the material AC: offset it to preserve the
    // tested actual CA on each shield, independent of item material quirks.
    baseArmorClass: profile.armorClass - CHRONICLES_ITEM_MATERIALS[materialId].armorClass,
    shieldToHitBonus: profile.toHit,
    allowedMembers: LEGACY_FRONT,
    description: `Escudo · armadura +${profile.armorClass}${profile.toHit ? `, acierto ${signed(profile.toHit)}` : ''}. Sólo clases con escudo y una mano libre.`,
  });
}

function catalog() {
  const items = {
    // Authored First Book gear keeps its ids: saves and shops reference them.
    'roadwatch-sabre': authoredEquipment({
      id: 'roadwatch-sabre', name: 'Sable de hierro de la guardia', slot: 'weapon',
      baseItemId: 'sabre', materialId: 'iron', basePrice: 6,
      baseDamageBonus: 1, baseDamageReduction: 0,
      baseToHitBonus: 1,
      weaponFamily: 'sword',
      allowedMembers: LEGACY_FRONT,
      description: 'Espada de hierro de la guardia · +2 acierto, +3 daño. Caballero, Paladín, Arquero, Ladrón o Ninja.',
    }),
    'roadwatch-vest': authoredEquipment({
      id: 'roadwatch-vest', name: 'Jubón de cuero de guardia', slot: 'armor',
      baseItemId: 'vest', materialId: 'leather', basePrice: 36,
      baseDamageBonus: 0, baseDamageReduction: 1,
      armorType: 'leather', baseArmorClass: 3,
      armorToHitBonus: 1,
      allowedMembers: LEGACY_ALL,
      description: 'Jubón reforzado de la guardia · +3 armadura, +1 acierto. Más precisión que la cota de escamas.',
    }),
  };
  for (const baseId of Object.keys(BASE_WEAPONS)) {
    const carved = baseId === 'dagger' || baseId === 'staff' ? CARVED_MATERIALS : [];
    const wooden = WOODEN_WEAPONS.includes(baseId) ? ['wooden'] : [];
    // Wooden bows are real bows, not a fictitious solid brass/steel bow.
    const forged = {
      bow: [], longbow: SHOD_BOW_MATERIALS, sling: SLING_MATERIALS,
    }[baseId] ?? WEAPON_MATERIALS;
    for (const materialId of [...wooden, ...forged, ...carved]) {
      items[`${materialId}-${baseId}`] = weaponItem(baseId, materialId);
    }
  }
  for (const baseId of Object.keys(BASE_ARMORS)) {
    const soft = baseId === 'padded' || baseId === 'leather';
    for (const materialId of soft ? SOFT_ARMOR_MATERIALS : METAL_ARMOR_MATERIALS) {
      items[`${materialId}-${baseId}`] = armorItem(baseId, materialId);
    }
  }
  for (const materialId of SHIELD_MATERIALS) items[`${materialId}-shield`] = shieldItem(materialId);
  return Object.freeze(items);
}

export const CHRONICLES_EQUIPMENT = catalog();

export const CHRONICLES_EQUIPMENT_SLOTS = Object.freeze(['weapon', 'missile', 'armor', 'shield']);

// Before the missile slot existed a bow sat in the weapon slot. Move it to
// where it belongs; a melee weapon is never moved.
export function chroniclesNormalizeMemberEquipment(memberEquipment) {
  const current = memberEquipment && typeof memberEquipment === 'object' ? memberEquipment : {};
  const legacy = CHRONICLES_EQUIPMENT[current.weapon];
  if (legacy?.slot !== 'missile') return current;
  const { weapon: _bow, ...rest } = current;
  return rest.missile ? current : { ...rest, missile: current.weapon };
}

function stock(state) {
  return state?.inventory && typeof state.inventory === 'object' && !Array.isArray(state.inventory)
    ? state.inventory : {};
}

// Under MM rules the hero's class decides what they may wield or wear;
// parties without a class sheet keep the authored per-hero allow-list.
export function chroniclesMemberCanEquip(member, item) {
  if (!member || !item) return false;
  const definition = chroniclesMM3Class(member.mm3?.classId);
  if (!definition) return item.allowedMembers.includes(member.id);
  if (item.slot === 'weapon' || item.slot === 'missile') return definition.weapons.includes(item.weaponFamily);
  if (item.slot === 'armor') return definition.maxArmorTier >= (CHRONICLES_MM3_ARMOR_TIERS[item.armorType] ?? 0);
  if (item.slot === 'shield') return definition.shield === true;
  return false;
}

function memberById(state, memberId) {
  return state?.party?.find((person) => person.id === memberId) || { id: memberId };
}

function equippedId(state, memberId, slot) {
  if (!CHRONICLES_EQUIPMENT_SLOTS.includes(slot)) return null;
  const id = chroniclesNormalizeMemberEquipment(state?.equipment?.[memberId])[slot];
  const item = CHRONICLES_EQUIPMENT[id];
  return item?.slot === slot && chroniclesMemberCanEquip(memberById(state, memberId), item) ? id : null;
}

export function chroniclesEquippedItem(state, memberId, slot) {
  return CHRONICLES_EQUIPMENT[equippedId(state, memberId, slot)] || null;
}

// Attack bonuses use the weapon in hand. A two-handed bow/crossbow cannot
// borrow a shield's accuracy *during the shot* in MM3. The shield stays
// equipped for melee/guard, so old saves and player loadouts stay intact.
// A one-handed sling retains the shield bonus; legacy combat is unchanged.
export function chroniclesEquipmentBonuses(state, memberId, { mode = 'melee' } = {}) {
  const attackSlot = mode === 'missile' ? 'missile' : 'weapon';
  const missile = mode === 'missile' ? chroniclesEquippedItem(state, memberId, 'missile') : null;
  const shieldBusy = state?.combatRules === 'mm3' && Boolean(missile?.twoHanded);
  const items = [attackSlot, 'armor', ...(shieldBusy ? [] : ['shield'])]
    .map((slot) => chroniclesEquippedItem(state, memberId, slot))
    .filter(Boolean);
  return {
    attackDamageBonus: items.reduce((sum, item) => sum + item.attackDamageBonus, 0),
    damageReduction: items.reduce((sum, item) => sum + item.damageReduction, 0),
    toHitBonus: items.reduce((sum, item) => sum + item.toHitBonus, 0),
    armorClassBonus: items.reduce((sum, item) => sum + item.armorClassBonus, 0),
  };
}

function inventoryQuantity(inventory, id) {
  const quantity = inventory[id]?.quantity;
  return Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0;
}

function putBack(inventory, item) {
  const current = inventoryQuantity(inventory, item.id);
  if (current >= 9999) return null;
  return {
    ...inventory,
    [item.id]: {
      id: item.id, name: item.name, description: item.description,
      quantity: current + 1,
    },
  };
}

export function chroniclesEquipItem(state, memberId, itemId) {
  if (!state || state.phase !== 'explore' || state.initiative) return state;
  const member = state.party?.find((person) => person.id === memberId && person.hp > 0);
  const item = CHRONICLES_EQUIPMENT[itemId];
  if (!member || !item) return state;
  if (!chroniclesMemberCanEquip(member, item)) {
    const classLabel = chroniclesMM3Class(member.mm3?.classId)?.label;
    return {
      ...state,
      message: classLabel
        ? `${member.name} (${classLabel}) no puede usar ${item.name}: su clase no lo permite.`
        : `${member.name} no puede usar ${item.name}.`,
    };
  }
  const inventory = stock(state);
  const count = inventoryQuantity(inventory, item.id);
  if (count < 1 || equippedId(state, memberId, item.slot) === item.id) return state;
  state = { ...state, equipment: { ...state.equipment, [memberId]: chroniclesNormalizeMemberEquipment(state.equipment?.[memberId]) } };
  // A shield needs a free hand: no shield beside a two-handed weapon.
  if (item.slot === 'shield' && chroniclesEquippedItem(state, memberId, 'weapon')?.twoHanded) {
    return { ...state, message: `${member.name} necesita una mano libre para el escudo.` };
  }
  const existing = chroniclesEquippedItem(state, memberId, item.slot);
  // Taking up a two-handed weapon stows the shield in the shared pack.
  const displacedShield = item.twoHanded && item.slot === 'weapon' ? chroniclesEquippedItem(state, memberId, 'shield') : null;
  let nextInventory = { ...inventory };
  if (count === 1) delete nextInventory[item.id];
  else nextInventory[item.id] = { ...inventory[item.id], quantity: count - 1 };
  for (const returned of [existing, displacedShield].filter(Boolean)) {
    nextInventory = putBack(nextInventory, returned);
    if (!nextInventory) return state;
  }
  const memberEquipment = { ...state.equipment?.[memberId], [item.slot]: item.id };
  if (displacedShield) delete memberEquipment.shield;
  return {
    ...state,
    inventory: nextInventory,
    equipment: { ...state.equipment, [memberId]: memberEquipment },
    message: `${member.name} equipa ${item.name}. ${item.description}`
      + (displacedShield ? ` ${displacedShield.name} vuelve a la mochila.` : ''),
  };
}

export function chroniclesUnequipItem(state, memberId, slot) {
  if (!state || state.phase !== 'explore' || state.initiative) return state;
  const member = state.party?.find((person) => person.id === memberId && person.hp > 0);
  const item = chroniclesEquippedItem(state, memberId, slot);
  if (!member || !item) return state;
  const inventory = putBack(stock(state), item);
  if (!inventory) return state;
  const currentEquipment = { ...chroniclesNormalizeMemberEquipment(state.equipment?.[memberId]) };
  delete currentEquipment[slot];
  return {
    ...state, inventory,
    equipment: { ...state.equipment, [memberId]: currentEquipment },
    message: `${member.name} guarda ${item.name} en la mochila.`,
  };
}
