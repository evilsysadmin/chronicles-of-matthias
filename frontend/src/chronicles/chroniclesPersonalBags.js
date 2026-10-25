// Personal MM3 backpacks allocate the authoritative party inventory; no
// objects are copied and gold remains a shared currency. Explicit ownership
// from saves or player transfers wins. Ownerless loot is spread across the
// party instead of being silently dumped into the first hero's backpack.
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
    // A legacy/loot stack has no owner yet: put the entire stack in the
    // least-populated personal bag. Prefer the party order when tied. Existing
    // allocations above are never moved (especially saved player transfers).
    if (remaining) {
      let recipient = members[0];
      for (const id of members.slice(1)) {
        if (Object.keys(bags[id]).length < Object.keys(bags[recipient]).length) recipient = id;
      }
      bags[recipient][itemId] = (bags[recipient][itemId] || 0) + remaining;
    }
  }
  return bags;
}

// A previously saved company may have explicitly persisted every single
// loose item against its first hero. Never silently reinterpret that save:
// offer a user-triggered, atomic redistribution instead.
export function chroniclesCanSharePartyLoot(state) {
  if (state?.combatRules !== 'mm3' || state.phase !== 'explore' || state.initiative
    || (state.party || []).length < 2) return false;
  const bags = chroniclesBagOwnership(state);
  const memberIds = state.party.map(({ id }) => id);
  const stock = Object.values(state.inventory || {})
    .filter((item) => item?.id !== GOLD)
    .reduce((sum, item) => sum + count(item?.quantity), 0);
  if (stock < 2) return false;
  const supplied = memberIds.filter((id) => Object.keys(bags[id] || {}).length > 0).length;
  return supplied < Math.min(memberIds.length, stock);
}

export function chroniclesSharePartyLoot(state) {
  if (!chroniclesCanSharePartyLoot(state)) return state;
  const ids = state.party.map(({ id }) => id);
  const bagOwners = Object.fromEntries(ids.map((id) => [id, {}]));
  let next = 0;
  // Round-robin individual copies so stacks of potions also circulate.
  // No global inventory, equipment, gold or save data is mutated in place.
  for (const [itemId, item] of Object.entries(state.inventory || {})) {
    if (itemId === GOLD) continue;
    const quantity = count(item?.quantity);
    if (!quantity) continue;
    const each = Math.floor(quantity / ids.length);
    const extra = quantity % ids.length;
    for (let i = 0; i < ids.length; i += 1) {
      const added = each + (((i - next + ids.length) % ids.length) < extra ? 1 : 0);
      if (added) bagOwners[ids[i]][itemId] = added;
    }
    next = (next + quantity) % ids.length;
  }
  return { ...state, bagOwners, message: 'La compañía reparte el botín entre sus mochilas.' };
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
