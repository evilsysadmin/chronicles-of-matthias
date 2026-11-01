// Authored town inns: entering is free, paying for an existing rest service
// is a separate explicit transaction. These functions own the reducer contract,
// never the dialog, so a replayed or stale UI action cannot mint food or HP.
import { chroniclesApplyContentAction, chroniclesApplyContentEffects, chroniclesGoldBalance, CHRONICLES_GOLD_ITEM_ID } from './chroniclesContentRuntime.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';

export const CHRONICLES_INN_FOOD = Object.freeze({
  id: 'road-rations',
  name: 'Raciones de viaje',
  description: 'Raciones guardadas en la mochila. El descanso de campo todavía no está disponible; no curan en combate.',
  price: 4,
});

const SWORDHAVEN_RUMORS = Object.freeze([
  'Dicen que el alcalde Aldric recibe visitantes en el Ayuntamiento, junto a la plaza. Los asuntos del Rey no pueden esperar.',
  'Las cloacas preocupan a los vecinos: hay quien habla de una compuerta en su extremo sureste.',
  'Los viajeros que llegan del norte mencionan el Camino de los Estandartes. No todos regresan con el mismo ánimo.',
]);
const TRAVELER_RUMORS = Object.freeze([
  'Un buen viajero pregunta por los caminos antes de salir, y por los precios antes de brindar.',
  'En las posadas se cuentan tantas historias como jarras se sirven. Conviene comprobarlas sobre el terreno.',
]);

export function chroniclesIsInn(entry) {
  return !!entry && (entry.visualType === 'building-tavern'
    || entry.id === 'first-book-healer' || String(entry.id || '').endsWith('-inn'));
}

export function chroniclesInnEntry(state, map) {
  const entry = (map?.interactables || []).find((candidate) =>
    candidate.id === state?.inn?.id && chroniclesIsInn(candidate));
  return entry && chroniclesTownCounterInReach(state, entry, map) ? entry : null;
}

export function chroniclesInnRestPrice(entry) {
  const cost = (entry?.action?.effects || []).find((effect) =>
    effect.type === 'consume-item' && effect.itemId === CHRONICLES_GOLD_ITEM_ID);
  return Number.isSafeInteger(cost?.quantity) && cost.quantity > 0 ? cost.quantity : null;
}

export function chroniclesInnName(entry) {
  return entry?.id === 'first-book-healer' ? 'La Espada Mellada' : 'Posada del viajero';
}

export function chroniclesInnRumors(entry) {
  return entry?.id === 'first-book-healer' ? SWORDHAVEN_RUMORS : TRAVELER_RUMORS;
}

export function chroniclesOpenInn(state, entry) {
  if (!chroniclesIsInn(entry) || state?.initiative) return state;
  return { ...state, inn: { id: entry.id, rumorIndex: -1 }, message: `Entras en ${chroniclesInnName(entry)}. La posadera te invita a acercarte al mostrador.` };
}

export function chroniclesCloseInn(state) {
  if (!state?.inn) return state;
  const { inn: _closed, ...rest } = state;
  return rest;
}

export function chroniclesInnRest(state, map) {
  const entry = chroniclesInnEntry(state, map);
  const price = chroniclesInnRestPrice(entry);
  if (!entry || price === null) return state;
  if (chroniclesGoldBalance(state) < price) {
    return { ...state, message: `Descansar cuesta ${price} oro. La posadera no fía, ni siquiera a Matthias.` };
  }
  // The same authored effects as the former one-click inn; living heroes
  // recover, fallen ones do not revive, and spell points are restored.
  const next = chroniclesApplyContentAction(state, entry.action);
  if (next === state) return state;
  return { ...next, turns: state.turns + 1 };
}

export function chroniclesInnBuyFood(state, map) {
  if (!chroniclesInnEntry(state, map)) return state;
  const item = CHRONICLES_INN_FOOD;
  if (chroniclesGoldBalance(state) < item.price) {
    return { ...state, message: `Las raciones cuestan ${item.price} oro. Hoy toca mirar el menú.` };
  }
  const next = chroniclesApplyContentEffects(state, [{
    type: 'exchange-item',
    costItemId: CHRONICLES_GOLD_ITEM_ID,
    costQuantity: item.price,
    itemId: item.id,
    name: item.name,
    description: item.description,
    quantity: 1,
  }]);
  return next === state ? state : {
    ...next, message: `Compras ${item.name.toLowerCase()} por ${item.price} oro. Quedan guardadas en la mochila de la compañía.`,
  };
}

export function chroniclesInnHearRumor(state, map) {
  const entry = chroniclesInnEntry(state, map);
  if (!entry) return state;
  const rumors = chroniclesInnRumors(entry);
  const index = (state.inn.rumorIndex + 1) % rumors.length;
  return {
    ...state,
    inn: { ...state.inn, rumorIndex: index },
    message: `La posadera cuenta: «${rumors[index]}»`,
  };
}
