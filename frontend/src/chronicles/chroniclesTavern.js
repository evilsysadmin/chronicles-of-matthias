// MM3 taverns get a room of their own: sleep the night, buy rations for the
// road (camping outside the towns eats them), stand the company a round,
// and tip the barkeep for a rumour.
//
// An authored interactable with `tavern: { ... }` opens the room; its own
// `action` and `requirements` stay the night's rest (price included), so the
// inn keeps working for anything that only knows the old counter.
import {
  CHRONICLES_GOLD_ITEM_ID,
  chroniclesApplyContentEffects,
  chroniclesGoldBalance,
  chroniclesRequirementFailure,
} from './chroniclesContentRuntime.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';

export const CHRONICLES_RATION_ITEM_ID = 'travel-ration';
export const CHRONICLES_RATION = Object.freeze({
  id: CHRONICLES_RATION_ITEM_ID,
  name: 'Ración de viaje',
  description: 'Pan duro, queso y cecina. Acampar fuera de los pueblos gasta una por héroe en pie.',
});
export const CHRONICLES_MAX_RATIONS = 40;

const DEFAULT_PRICES = Object.freeze({ ration: 1, drink: 2, tip: 1 });

function tavernEntry(state, map, tavernId) {
  const entry = (map?.interactables || []).find((item) => item.id === tavernId && item.tavern);
  if (!entry || !chroniclesTownCounterInReach(state, entry, map)) return null;
  return entry;
}

export function chroniclesTavernPrice(entry, what) {
  if (what === 'rest') {
    const authored = Number(entry?.tavern?.prices?.rest);
    if (Number.isFinite(authored) && authored >= 0) return authored;
    const gold = (entry?.requirements || []).find((requirement) => requirement.itemId === CHRONICLES_GOLD_ITEM_ID);
    return Math.max(0, Number(gold?.quantity || 0));
  }
  const price = Number(entry?.tavern?.prices?.[what]);
  return Number.isFinite(price) && price >= 0 ? price : DEFAULT_PRICES[what];
}

export function chroniclesRations(state) {
  const quantity = state?.inventory?.[CHRONICLES_RATION_ITEM_ID]?.quantity;
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
}

export function chroniclesOpenTavern(state, entry) {
  return {
    ...state,
    tavern: { id: entry.id },
    message: entry.tavern.greeting || entry.action?.message || `${entry.label}.`,
  };
}

export function chroniclesCloseTavern(state) {
  if (!state?.tavern) return state;
  const { tavern: _closed, ...rest } = state;
  return rest;
}

function pay(state, amount) {
  if (amount <= 0) return state;
  return chroniclesApplyContentEffects(state, [{ type: 'consume-item', itemId: CHRONICLES_GOLD_ITEM_ID, quantity: amount }]);
}

function broke(state, what, price) {
  return { ...state, message: `${what} cuesta ${price} oro. La bolsa no llega.` };
}

// The night: exactly the inn's own authored rest.
export function chroniclesTavernRest(state, map) {
  const entry = state?.tavern ? tavernEntry(state, map, state.tavern.id) : null;
  if (!entry?.action) return state;
  const price = chroniclesTavernPrice(entry, 'rest');
  if (chroniclesGoldBalance(state) < price) return broke(state, 'La noche', price);
  const rested = chroniclesApplyContentEffects(state, entry.action.effects || []);
  return { ...rested, message: entry.action.message || rested.message, turns: (state.turns || 0) + 1 };
}

export function chroniclesTavernBuyRations(state, map, quantity = 1) {
  const entry = state?.tavern ? tavernEntry(state, map, state.tavern.id) : null;
  if (!entry) return state;
  const count = Math.max(1, Math.min(10, Math.floor(Number(quantity) || 1)));
  const room = CHRONICLES_MAX_RATIONS - chroniclesRations(state);
  if (room <= 0) return { ...state, message: `La mochila no admite más de ${CHRONICLES_MAX_RATIONS} raciones.` };
  const buying = Math.min(count, room);
  const price = chroniclesTavernPrice(entry, 'ration') * buying;
  if (chroniclesGoldBalance(state) < price) return broke(state, buying === 1 ? 'Una ración' : `${buying} raciones`, price);
  const paid = pay(state, price);
  if (price > 0 && paid === state) return state;
  const stocked = chroniclesApplyContentEffects(paid, [{ type: 'grant-item', itemId: CHRONICLES_RATION_ITEM_ID, name: CHRONICLES_RATION.name, description: CHRONICLES_RATION.description, quantity: buying }]);
  return {
    ...stocked,
    message: `${entry.tavern.keeper || 'El tabernero'} envuelve ${buying === 1 ? 'una ración' : `${buying} raciones`} en un paño por ${price} oro. Lleváis ${chroniclesRations(stocked)}.`,
  };
}

// A round for the company: a little warmth back, and a story.
export function chroniclesTavernDrink(state, map) {
  const entry = state?.tavern ? tavernEntry(state, map, state.tavern.id) : null;
  if (!entry) return state;
  const price = chroniclesTavernPrice(entry, 'drink');
  if (chroniclesGoldBalance(state) < price) return broke(state, 'Una ronda', price);
  const paid = pay(state, price);
  if (price > 0 && paid === state) return state;
  const party = paid.party.map((member) => (member.hp > 0
    ? { ...member, hp: Math.min(member.maxHp, member.hp + 2) }
    : member));
  const toasts = entry.tavern.toasts?.length ? entry.tavern.toasts : ['La compañía brinda por los que no están.'];
  const toast = toasts[(Number(state.turns) || 0) % toasts.length];
  return { ...paid, party, message: `Ronda para la compañía por ${price} oro (+2 PV). ${toast}` };
}

// Rumours rotate per tavern; one whose matter is settled (its `when` no
// longer holds) is not told any more. The current objective is always fair
// game when nothing authored is left.
export function chroniclesTavernRumors(state, entry) {
  return (entry?.tavern?.rumors || []).filter((rumor) => rumor?.text
    && !chroniclesRequirementFailure(state, rumor.when || []));
}

export function chroniclesTavernTip(state, map, objectiveHint = null) {
  const entry = state?.tavern ? tavernEntry(state, map, state.tavern.id) : null;
  if (!entry) return state;
  const price = chroniclesTavernPrice(entry, 'tip');
  if (chroniclesGoldBalance(state) < price) return broke(state, 'La propina', price);
  const paid = pay(state, price);
  if (price > 0 && paid === state) return state;
  const told = Math.max(0, Number(state.tavernTips?.[entry.id] || 0));
  const rumors = chroniclesTavernRumors(paid, entry);
  const keeper = entry.tavern.keeper || 'El tabernero';
  const text = rumors.length
    ? rumors[told % rumors.length].text
    : objectiveHint
      ? `Lo que se comenta en la barra: ${objectiveHint}`
      : 'Hoy no corre nada que valga una moneda. Vuelve otro día.';
  const journal = Array.isArray(paid.journal) ? paid.journal : [];
  const journalId = `rumor-${entry.id}-${told}`;
  return {
    ...paid,
    tavernTips: { ...paid.tavernTips, [entry.id]: told + 1 },
    journal: journal.some((item) => item.id === journalId) ? journal : [...journal, {
      id: journalId, title: `Rumor · ${entry.tavern.name || entry.label}`, body: text, sigil: '❦',
    }],
    message: `${keeper} se guarda la moneda y baja la voz: «${text}»`,
  };
}
