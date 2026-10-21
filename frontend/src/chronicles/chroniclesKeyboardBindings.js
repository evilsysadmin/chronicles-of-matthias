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

// The physical 1–4 keys identify these four heroes by stable IDs, not by
// array position (which can change in view adapters and initiative ordering).
export const CHRONICLES_PARTY_SLOT_IDS = Object.freeze(['matthias', 'rook', 'bishop', 'knight']);

// Pure, shared event filter for the four party-selection hotkeys.
export function chroniclesPartyHotkeyMember(event, party) {
  if (!event || !/^[1-4]$/.test(event.key) || event.repeat || event.defaultPrevented
    || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  if (!Array.isArray(party)) return null;
  const slotId = CHRONICLES_PARTY_SLOT_IDS[Number(event.key) - 1];
  const memberId = (member) => member?.slotId || member?.id;
  const hero = party.find((member) => memberId(member) === slotId);
  if (hero) return hero;
  // Never substitute the wrong hero when a canonical party is incomplete.
  // An unrelated small roster can still use the original positional contract.
  if (party.some((member) => CHRONICLES_PARTY_SLOT_IDS.includes(memberId(member)))) return null;
  return party[Number(event.key) - 1] || null;
}
