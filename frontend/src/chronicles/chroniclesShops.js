// MM3-style shops: an authored merchant (`shop` on its map entry) opens a
// counter with a stock list instead of firing a single scripted exchange.
// Buying and selling are atomic gold ⇄ item swaps on the shared inventory,
// validated against the merchant actually standing at the party's cell, so
// a stale UI or a replayed action can never buy from a closed or absent shop.
import {
  CHRONICLES_GOLD_ITEM_ID,
  chroniclesApplyContentEffects,
  chroniclesGoldBalance,
} from './chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { CHRONICLES_CONSUMABLES, chroniclesShopItem } from './chroniclesConsumables.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';

const SELL_RATE = 0.5;

function shopEntry(state, map, shopId) {
  const entry = (map?.interactables || []).find((item) => item.id === shopId && item.shop);
  if (!entry) return null;
  // Town entrances also work from the immediately adjacent, facing street tile.
  if (!chroniclesTownCounterInReach(state, entry, map)) return null;
  return entry;
}

export function chroniclesShopStock(entry) {
  return (entry?.shop?.stock || [])
    .map((itemId) => chroniclesShopItem(itemId))
    .filter(Boolean);
}

export function chroniclesShopSellPrice(item) {
  return item ? Math.max(1, Math.floor(item.price * SELL_RATE)) : 0;
}

// What the party could sell here: unequipped catalog gear in the shared pack,
// and potions or scrolls at the shop that deals in them.
export function chroniclesShopSellable(state, entry = null) {
  const inventory = state?.inventory && typeof state.inventory === 'object' ? state.inventory : {};
  const dealsInConsumables = (entry?.shop?.stock || []).some((id) => CHRONICLES_CONSUMABLES[id]);
  return Object.entries(inventory)
    .filter(([id, item]) => (CHRONICLES_EQUIPMENT[id] || (dealsInConsumables && CHRONICLES_CONSUMABLES[id]))
      && Number(item?.quantity) > 0)
    .map(([id, item]) => ({ item: chroniclesShopItem(id), quantity: Number(item.quantity) }));
}

export function chroniclesOpenShop(state, entry) {
  return {
    ...state,
    shop: { id: entry.id },
    message: entry.shop.greeting || entry.action?.message || `${entry.label}.`,
  };
}

export function chroniclesCloseShop(state) {
  if (!state?.shop) return state;
  const { shop: _closed, ...rest } = state;
  return rest;
}

export function chroniclesShopBuy(state, map, itemId) {
  const entry = state?.shop ? shopEntry(state, map, state.shop.id) : null;
  if (!entry || !entry.shop.stock.includes(itemId)) return state;
  const item = chroniclesShopItem(itemId);
  if (!item) return state;
  if (chroniclesGoldBalance(state) < item.price) {
    return { ...state, message: `${item.name} cuesta ${item.price} oro. La bolsa no da para tanto.` };
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
  if (next === state) return state;
  return {
    ...next,
    message: item.slot === 'consumable'
      ? `Compras ${item.name} por ${item.price} oro. Úsalo desde MAGIA/OBJETOS (tecla I).`
      : `Compras ${item.name} por ${item.price} oro. Equípalo desde la ficha del personaje.`,
  };
}

// Small UI acknowledgement only after the atomic inventory + purse exchange.
// Refused purchases/sales, stale merchant views and cap failures never toast.
export function chroniclesShopTradeNotice(previous, next, action) {
  if (!previous || !next || !action || previous === next) return '';
  const item = chroniclesShopItem(action.itemId);
  if (!item) return '';
  const before = Number(previous.inventory?.[item.id]?.quantity || 0);
  const after = Number(next.inventory?.[item.id]?.quantity || 0);
  const goldBefore = chroniclesGoldBalance(previous);
  const goldAfter = chroniclesGoldBalance(next);
  if (action.type === 'shop-buy' && after === before + 1
    && goldAfter === goldBefore - item.price) return `¡Compraste ${item.name}!`;
  if (action.type === 'shop-sell' && after === before - 1
    && goldAfter === goldBefore + chroniclesShopSellPrice(item)) return `¡Vendiste ${item.name}!`;
  return '';
}

export function chroniclesShopSell(state, map, itemId) {
  const entry = state?.shop ? shopEntry(state, map, state.shop.id) : null;
  const item = chroniclesShopItem(itemId);
  if (!entry || !item || entry.shop.buys === false) return state;
  if (!chroniclesShopSellable(state, entry).some((offer) => offer.item.id === itemId)) return state;
  const owned = Number(state.inventory?.[itemId]?.quantity || 0);
  if (owned < 1) return state;
  const price = chroniclesShopSellPrice(item);
  // Preflight the purse cap so a sale never takes the item without paying.
  if (chroniclesGoldBalance(state) + price > 9999) return state;
  const next = chroniclesApplyContentEffects(state, [
    { type: 'consume-item', itemId, quantity: 1 },
    { type: 'grant-gold', amount: price },
  ]);
  if (next === state) return state;
  return { ...next, message: `Vendes ${item.name} por ${price} oro.` };
}
