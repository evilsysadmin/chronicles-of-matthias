// Things the company carries to use, not to wear: potions, a revive draught
// and spell scrolls. They live in the shared pack (`inventory[id].quantity`)
// like any other item, are sold by the apothecaries of Terra's towns and are
// used from the OBJETOS menu, in combat (costs the user's turn) or out of it.
// Potions go to whoever needs them most, like a healing spell does.
//
// A scroll is a spell anyone can read once: it strikes like the spell would,
// with no spell points and no school needed.
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp, chroniclesMostWoundedAlly } from './chroniclesMagic.js';

function consumable(spec) {
  return Object.freeze({ slot: 'consumable', ...spec });
}

export const CHRONICLES_CONSUMABLES = Object.freeze({
  'healing-potion': consumable({
    id: 'healing-potion', name: 'Poción de curación', price: 15, kind: 'heal', amount: 15,
    description: 'Cura 15 PV a quien la bebe.',
  }),
  'greater-healing-potion': consumable({
    id: 'greater-healing-potion', name: 'Poción de curación mayor', price: 45, kind: 'heal', amount: 35,
    description: 'Cura 35 PV a quien la bebe.',
  }),
  'mana-potion': consumable({
    id: 'mana-potion', name: 'Poción de maná', price: 20, kind: 'mana', amount: 8,
    description: 'Devuelve 8 puntos de hechizo a quien la bebe.',
  }),
  'revive-draught': consumable({
    id: 'revive-draught', name: 'Elixir de retorno', price: 60, kind: 'revive', fraction: 1 / 3,
    description: 'Levanta a un compañero caído con un tercio de su vida.',
  }),
  'fire-scroll': consumable({
    id: 'fire-scroll', name: 'Pergamino de llamas', price: 25, kind: 'scroll',
    spell: Object.freeze({ id: 'fire-scroll', name: 'Pergamino de llamas', damage: 14, reach: 3, element: 'fire', cost: 0 }),
    description: 'Lanza una llamarada a tres casillas: 14 de fuego. No falla. Un solo uso.',
  }),
  'lightning-scroll': consumable({
    id: 'lightning-scroll', name: 'Pergamino de tormenta', price: 40, kind: 'scroll',
    spell: Object.freeze({ id: 'lightning-scroll', name: 'Pergamino de tormenta', damage: 20, reach: 4, element: 'electricity', cost: 0 }),
    description: 'Un rayo a cuatro casillas: 20 de electricidad. No falla. Un solo uso.',
  }),
});

export const CHRONICLES_CONSUMABLE_IDS = Object.freeze(Object.keys(CHRONICLES_CONSUMABLES));

/** Anything a shop may sell: gear or a consumable. */
export function chroniclesShopItem(itemId) {
  return CHRONICLES_EQUIPMENT[itemId] || CHRONICLES_CONSUMABLES[itemId] || null;
}

export function chroniclesConsumableCount(state, itemId) {
  if (!CHRONICLES_CONSUMABLES[itemId]) return 0;
  return Math.max(0, Math.floor(Number(state?.inventory?.[itemId]?.quantity) || 0));
}

/** What the pack holds that can be used, in catalog order. */
export function chroniclesCarriedConsumables(state) {
  return CHRONICLES_CONSUMABLE_IDS
    .map((id) => ({ item: CHRONICLES_CONSUMABLES[id], quantity: chroniclesConsumableCount(state, id) }))
    .filter((entry) => entry.quantity > 0);
}

function missingSp(state, member) {
  return chroniclesMemberMaxSp(state, member) - chroniclesMemberSp(state, member);
}

/**
 * Who an item lands on. `targetId` picks a companion explicitly; otherwise a
 * healing potion goes to the most wounded ally, a mana potion to the caster
 * missing the most spell points and the revive draught to the fallen
 * companion with the most maximum HP. A scroll has no ally target.
 */
export function chroniclesConsumableTarget(state, item, targetId = null) {
  const party = state?.party || [];
  if (!item || item.kind === 'scroll') return null;
  const fits = (member) => {
    if (item.kind === 'revive') return member.hp <= 0;
    if (member.hp <= 0) return false;
    if (item.kind === 'heal') return member.hp < member.maxHp;
    if (item.kind === 'mana') return missingSp(state, member) > 0;
    return false;
  };
  if (targetId) {
    const chosen = party.find((member) => member.id === targetId);
    return chosen && fits(chosen) ? chosen : null;
  }
  const candidates = party.filter(fits);
  if (item.kind === 'heal') return chroniclesMostWoundedAlly(state);
  if (item.kind === 'mana') return candidates.sort((a, b) => missingSp(state, b) - missingSp(state, a))[0] || null;
  return candidates.sort((a, b) => b.maxHp - a.maxHp)[0] || null;
}
