// User-facing pickup receipts must come from the committed inventory delta,
// not from the attempted action or from a generic combat drop table.
// Do not reward twice after restore, refused actions, shopping, or transfers.
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { chroniclesBagOwnership } from './chroniclesPersonalBags.js';

const COMBAT_LOOT_ACTIONS = new Set(['attack', 'volley', 'cast', 'use-item']);
const INVENTORY_ONLY_ACTIONS = new Set([
  'shop-buy', 'shop-sell', 'equip-item', 'unequip-item', 'transfer-item',
  'share-party-loot', 'inn-buy-food',
]);
const count = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  if (typeof value === 'string' && !value.trim()) return 0;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 9999 ? n : 0;
};

export function chroniclesLootNotice(before, after, action) {
  if (!before || !after || before === after) return null;
  const kind = typeof action === 'string' ? action : action?.type;
  if (INVENTORY_ONLY_ACTIONS.has(kind)) return null;
  // Only name a recipient when the committed ownership delta proves that
  // the complete new gear stack went to exactly one hero. No guesses when
  // restoring legacy ownership, splitting stacks or changing the party.
  let ownership = null;
  const ownerFor = (id, gained) => {
    if (before.combatRules !== 'mm3' || after.combatRules !== 'mm3'
        || !Object.hasOwn(CHRONICLES_EQUIPMENT, id)) return null;
    if (!Array.isArray(before.party) || !Array.isArray(after.party)
        || before.party.length !== after.party.length
        || !before.party.every((hero, i) => hero?.id && hero.id === after.party[i]?.id)) return null;
    ownership ||= [chroniclesBagOwnership(before), chroniclesBagOwnership(after)];
    const [previous, next] = ownership;
    const changes = after.party.map(hero => ({
      hero, delta: (next[hero.id]?.[id] || 0) - (previous[hero.id]?.[id] || 0),
    })).filter(entry => entry.delta !== 0);
    if (changes.length !== 1 || changes[0].delta !== gained) return null;
    const hero = changes[0].hero;
    return typeof hero.name === 'string' && hero.name.trim()
      ? { memberId: hero.id, name: hero.name.trim() } : null;
  };
  const entries = Object.entries(after.inventory || {}).flatMap(([id, item]) => {
    const gained = count(item?.quantity) - count(before.inventory?.[id]?.quantity);
    if (gained <= 0) return [];
    const name = id === 'crown-gold'
      ? (gained === 1 ? 'moneda de oro' : 'monedas de oro')
      : String(item?.name || id).trim();
    if (!name) return [];
    const owner = ownerFor(id, gained);
    return [{ id, name, quantity: gained, ...(owner ? { owner } : {}) }];
  });
  if (!entries.length) return null;
  const visible = entries.slice(0, 3);
  const names = visible.map(({ name, quantity, id, owner }) => {
    const label = id === 'crown-gold' ? `${quantity} ${name}` : quantity > 1 ? `${quantity} × ${name}` : name;
    return owner ? `${label} (mochila de ${owner.name})` : label;
  }).join(' · ');
  const excess = entries.length > visible.length ? ` · +${entries.length - visible.length} más` : '';
  const combat = COMBAT_LOOT_ACTIONS.has(kind);
  return {
    kind: combat ? 'loot' : 'pickup',
    text: `${combat ? 'Botín' : 'Encuentras'}: ${names}${excess}`,
    entries,
  };
}
