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
    || event.ctrlKey || event.altKey || event.metaKey) return null;
  // Escape is a dialogue-level dismissal even with a range/text control
  // focused. Every other shortcut remains owned by focused form controls.
  if (event.key === 'Escape') return confirmExitWithoutSaving ? 'cancel-exit' : 'close';
  const target = event.target;
  if (target?.isContentEditable
    || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  if (saveBusy || confirmExitWithoutSaving) return null;
  if (event.key === 's' || event.key === 'S') return 'save';
  if (event.key === 'q' || event.key === 'Q') return 'request-exit';
  return null;
}

// The adventure menu advertises itself as a modal dialogue. Keep keyboard
// focus within its own native <details> while open: otherwise Tab can escape
// behind the overlay and accidentally operate the game HUD. Native Tab order
// remains untouched everywhere except when wrapping the first/last control.
export function chroniclesContainAdventureMenuTab(event, menuDetails) {
  if (event?.key !== 'Tab' || !menuDetails?.open || event.defaultPrevented
    || event.ctrlKey || event.altKey || event.metaKey) return false;
  // The Q confirmation is an inner decision: while visible, Tab must
  // remain between "Sí, salir" and the safely focused "Cancelar" rather
  // than reaching the mixer, Save or Continue behind the question.
  const confirmation = menuDetails.querySelector?.(
    '[role="group"][aria-label="Confirmar salida sin guardar"]',
  );
  const scope = confirmation || menuDetails;
  const controls = Array.from(scope.querySelectorAll(
    'summary, button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter((control) => control.getClientRects().length > 0
    && control.getAttribute('aria-hidden') !== 'true'
    && !control.closest('[hidden], [inert]')
    && control.ownerDocument.defaultView.getComputedStyle(control).visibility !== 'hidden');
  if (!controls.length) return false;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = menuDetails.ownerDocument.activeElement;
  // If the confirmation opened while focus was on another menu control,
  // redirect keyboard navigation to its safe default instead of letting
  // the next Tab jump through actions underneath the confirmation.
  if (confirmation && !controls.includes(active)) {
    event.preventDefault();
    const safeCancel = controls.find((control) => control.textContent?.trim() === 'Cancelar');
    (safeCancel || last).focus();
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

// A modal details surface must own focus even if it was opened by touch,
// external scripting or a controller that did not focus the summary first.
// Redirect stray focus to the safe exit Cancel action while Q's question is
// up; otherwise return to the menu opener. This also prevents Tab starting
// on a background HUD control, beyond the edge-only Tab wrapper above.
export function chroniclesRestoreAdventureMenuFocus(menuDetails, focused) {
  if (!menuDetails?.open || !focused || menuDetails.contains(focused)) return false;
  const question = menuDetails.querySelector?.(
    '[role="group"][aria-label="Confirmar salida sin guardar"]',
  );
  const safe = question?.querySelector('button:last-of-type')
    || menuDetails.querySelector('summary');
  if (!safe || safe === focused) return false;
  safe.focus();
  return true;
}

// The adventure menu declares aria-modal. Background game controls must
// therefore not react to taps/clicks while it is open. Capture at the root,
// but let every control inside the actual menu behave natively.
export function chroniclesBlockAdventureMenuBackgroundEvent(event, menuOpen = false) {
  if (!menuOpen || !event?.target
    || event.target.closest?.('.chronicles-game-menu')) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
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
// A modal adventure menu owns keyboard focus: 1–4 must not silently change
// the active hero underneath an unrelated Save/Quit confirmation.
export function chroniclesPartyHotkeyMember(event, party, { menuOpen = false } = {}) {
  if (menuOpen || !event || !/^[1-4]$/.test(event.key) || event.repeat || event.defaultPrevented
    || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  return chroniclesPartyHotkeySlots(party)
    .find(({ slot }) => slot === Number(event.key))?.member || null;
}
