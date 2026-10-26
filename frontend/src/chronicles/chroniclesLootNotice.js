// User-facing pickup receipts must come from the committed inventory delta,
// not from the attempted action or from a generic combat drop table.
// Do not reward twice after restore, refused actions, shopping, or transfers.
const COMBAT_LOOT_ACTIONS = new Set(['attack', 'volley', 'cast', 'use-item']);
const INVENTORY_ONLY_ACTIONS = new Set([
  'shop-buy', 'shop-sell', 'equip-item', 'unequip-item', 'transfer-item',
  'share-party-loot', 'inn-buy-food',
]);
const count = (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

export function chroniclesLootNotice(before, after, action) {
  if (!before || !after || before === after) return null;
  const kind = typeof action === 'string' ? action : action?.type;
  if (INVENTORY_ONLY_ACTIONS.has(kind)) return null;
  const entries = Object.entries(after.inventory || {}).flatMap(([id, item]) => {
    const gained = count(item?.quantity) - count(before.inventory?.[id]?.quantity);
    if (gained <= 0) return [];
    const name = id === 'crown-gold'
      ? (gained === 1 ? 'moneda de oro' : 'monedas de oro')
      : String(item?.name || id).trim();
    if (!name) return [];
    return [{ id, name, quantity: gained }];
  });
  if (!entries.length) return null;
  const visible = entries.slice(0, 3);
  const names = visible.map(({ name, quantity, id }) => (
    id === 'crown-gold' || quantity > 1 ? `${quantity} × ${name}` : name
  )).join(' · ');
  const excess = entries.length > visible.length ? ` · +${entries.length - visible.length} más` : '';
  const combat = COMBAT_LOOT_ACTIONS.has(kind);
  return {
    kind: combat ? 'loot' : 'pickup',
    text: `${combat ? 'Botín' : 'Recogido'}: ${names}${excess}`,
    entries,
  };
}
