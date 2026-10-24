// Personal MM3 backpacks are allocations of the authoritative party inventory,
// NOT extra copies of items. Gold remains a shared party currency. Any stock
// from pre-backpack saves or new loot is assigned to the first party member.
const GOLD = 'crown-gold';

function count(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(9999, n) : 0;
}

export function chroniclesBagOwnership(state) {
  const members = (state?.party || []).map(({ id }) => id).filter((id) => typeof id === 'string');
  const bags = Object.fromEntries(members.map((id) => [id, {}]));
  if (!members.length) return bags;
  for (const [itemId, item] of Object.entries(state?.inventory || {})) {
    if (itemId === GOLD) continue;
    let remaining = count(item?.quantity);
    if (!remaining) continue;
    for (const id of members) {
      const allocated = Math.min(remaining, count(state?.bagOwners?.[id]?.[itemId]));
      if (allocated) bags[id][itemId] = allocated;
      remaining -= allocated;
    }
    // Older saves and newly awarded loot have no ownership entry. Keep every
    // copy rather than making it vanish or duplicating it for each hero.
    if (remaining) bags[members[0]][itemId] = (bags[members[0]][itemId] || 0) + remaining;
  }
  return bags;
}

export function chroniclesBagQuantity(state, memberId, itemId) {
  if (state?.combatRules !== 'mm3') return count(state?.inventory?.[itemId]?.quantity);
  return chroniclesBagOwnership(state)[memberId]?.[itemId] || 0;
}

export function chroniclesBagInventoryEntries(state, memberId) {
  if (state?.combatRules !== 'mm3') {
    return Object.values(state?.inventory || {}).filter((item) => item && item.id !== GOLD && count(item.quantity));
  }
  const mine = chroniclesBagOwnership(state)[memberId] || {};
  return Object.entries(mine)
    .map(([itemId, quantity]) => ({ ...state.inventory[itemId], id: itemId, quantity }))
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
}

export function chroniclesTransferBagItem(state, fromId, toId, itemId, quantity = 1) {
  if (state?.combatRules !== 'mm3' || state.phase !== 'explore' || state.initiative
    || fromId === toId || itemId === GOLD || !Number.isSafeInteger(quantity) || quantity < 1
    || !(state.party || []).some((member) => member.id === fromId)
    || !(state.party || []).some((member) => member.id === toId)) return state;
  const owners = chroniclesBagOwnership(state);
  const available = owners[fromId]?.[itemId] || 0;
  if (available < quantity || !state.inventory?.[itemId]) return state;
  const destination = (state.party || []).find((member) => member.id === toId);
  const source = (state.party || []).find((member) => member.id === fromId);
  const updated = {
    ...owners,
    [fromId]: { ...owners[fromId] },
    [toId]: { ...owners[toId] },
  };
  const remainder = available - quantity;
  if (remainder) updated[fromId][itemId] = remainder;
  else delete updated[fromId][itemId];
  updated[toId][itemId] = (updated[toId][itemId] || 0) + quantity;
  return {
    ...state,
    bagOwners: updated,
    message: `${source.name} entrega ${quantity} × ${state.inventory[itemId].name || itemId} a ${destination.name}.`,
  };
}

// Equipping removes one item from the hero's own bag. Replaced equipment
// returns to that same hero, even when an incoming two-handed weapon also
// stows their shield. The party inventory remains the canonical item total.
export function chroniclesBagAfterEquipment(state, memberId, removedId, returned, nextInventory) {
  if (state?.combatRules !== 'mm3') return state?.bagOwners;
  const bags = chroniclesBagOwnership(state);
  const own = { ...(bags[memberId] || {}) };
  if (removedId) {
    const left = (own[removedId] || 0) - 1;
    if (left > 0) own[removedId] = left;
    else delete own[removedId];
  }
  for (const item of returned) {
    own[item.id] = (own[item.id] || 0) + 1;
  }
  return chroniclesBagOwnership({
    ...state,
    inventory: nextInventory,
    bagOwners: { ...bags, [memberId]: own },
  });
}
