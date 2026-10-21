// First-person control contract shared with regression tests:
// directional arrows move/turn; A and S never move the party.
export const CHRONICLES_DIRECTION_KEYS = Object.freeze({
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
});

export function chroniclesCombatKeyMode(key) {
  if (key === 'a' || key === 'A') return 'melee';
  if (key === 's' || key === 'S') return 'missile';
  // Optional historical auto-attack alias; not a movement binding.
  if (key === ' ') return 'auto';
  return null;
}

// Adventure-menu shortcuts have their own scope: S must continue to shoot
// outside the pause menu, while Q requests (never confirms) an unsafe exit.
// Do not steal keys from text fields or repeated/composed browser events.
export function chroniclesAdventureMenuShortcut(event, {
  menuOpen = false, saveBusy = false, confirmExitWithoutSaving = false,
} = {}) {
  if (!menuOpen || !event || event.repeat || event.defaultPrevented || event.isComposing
    || event.ctrlKey || event.altKey || event.metaKey || saveBusy || confirmExitWithoutSaving) return null;
  const target = event.target;
  if (target?.isContentEditable
    || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  if (event.key === 's' || event.key === 'S') return 'save';
  if (event.key === 'q' || event.key === 'Q') return 'request-exit';
  return null;
}

// The physical 1–4 keys identify these four heroes by stable IDs, not by
// array position (which can change in view adapters and initiative ordering).
export const CHRONICLES_PARTY_SLOT_IDS = Object.freeze(['matthias', 'rook', 'bishop', 'knight']);

/**
 * Visible party order and numeric keys share this same stable slot contract.
 * Missing canonical heroes leave holes rather than borrowing someone else's
 * number. Arbitrary noncanonical rosters keep their historical 1–4 order.
 */
export function chroniclesPartyHotkeySlots(party) {
  if (!Array.isArray(party)) return [];
  const memberId = (member) => member?.slotId || member?.id;
  if (party.some((member) => CHRONICLES_PARTY_SLOT_IDS.includes(memberId(member)))) {
    return CHRONICLES_PARTY_SLOT_IDS.flatMap((id, index) => {
      const member = party.find((candidate) => memberId(candidate) === id);
      return member ? [{ slot: index + 1, member }] : [];
    });
  }
  return party.slice(0, 4).map((member, index) => ({ slot: index + 1, member }));
}

// Pure, shared event filter for the four party-selection hotkeys.
export function chroniclesPartyHotkeyMember(event, party) {
  if (!event || !/^[1-4]$/.test(event.key) || event.repeat || event.defaultPrevented
    || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  return chroniclesPartyHotkeySlots(party)
    .find(({ slot }) => slot === Number(event.key))?.member || null;
}
