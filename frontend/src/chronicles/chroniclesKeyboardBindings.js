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
  // Space is intentionally not a combat shortcut. Only A performs melee;
  // S remains the explicit ranged/volley command.
  return null;
}

// Adventure-menu shortcuts have their own scope: S must continue to shoot
// outside the pause menu, while Q requests (never confirms) an unsafe exit.
// Do not steal keys from text fields or repeated/composed browser events.
export function chroniclesAdventureMenuShortcut(event, {
  menuOpen = false, saveBusy = false, confirmExitWithoutSaving = false,
  subpageOpen = false,
} = {}) {
  if (!menuOpen || !event || event.repeat || event.defaultPrevented || event.isComposing
    || event.ctrlKey || event.altKey || event.metaKey) return null;
  // Escape is a dialogue-level dismissal even with a range/text control
  // focused. Every other shortcut remains owned by focused form controls.
  if (event.key === 'Escape') return confirmExitWithoutSaving ? 'cancel-exit'
    : subpageOpen ? 'back-feedback' : 'close';
  // Pages within the adventure folio own their own keyboard interactions.
  // Do not save or request a dangerous exit from feedback navigation buttons
  // or the still-focusable outer summary while the feedback page is visible.
  if (subpageOpen) return null;
  const target = event.target;
  if (target?.isContentEditable
    || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  if (saveBusy || confirmExitWithoutSaving) return null;
  if (event.key === 's' || event.key === 'S') return 'save';
  if (event.key === 'q' || event.key === 'Q') return 'request-exit';
  return null;
}

// The global Back/Escape stack dispatches at document level BEFORE a
// spell/objects folio's window handler. The most visible first-person layer
// must be dismissed first; never open the adventure menu behind another
// active modal just because that modal owns a separate keydown listener.
export function chroniclesFirstPersonEscapeAction({
  menuOpen = false,
  confirmExitWithoutSaving = false,
  feedbackOpen = false,
  spellMenuOpen = false,
  sheetOpen = false,
  shopOpen = false,
  guildOpen = false,
  innOpen = false,
  adminOpen = false,
  audienceOpen = false,
  automapOpen = false,
  journalOpen = false,
  quickStatusOpen = false,
} = {}) {
  if (menuOpen && confirmExitWithoutSaving) return 'cancel-exit';
  // Escape and browser Back must first leave the nested feedback page, even
  // when the outer summary (rather than the textarea) owns keyboard focus.
  if (menuOpen && feedbackOpen) return 'back-feedback';
  // The character dossier can sit on top of a merchant/guild. Dismiss its
  // own topmost layer first, rather than closing the shop behind it.
  if (sheetOpen) return 'close-sheet';
  if (innOpen) return 'close-inn';
  if (shopOpen) return 'close-shop';
  if (guildOpen) return 'close-guild';
  if (spellMenuOpen) return 'close-spell';
  if (adminOpen) return 'close-admin';
  if (audienceOpen) return 'close-audience';
  if (automapOpen) return 'close-automap';
  // The journal and quick-status overlay normally own a newer Back entry;
  // these guards also cover the short React mount/unmount transition.
  if (journalOpen) return 'close-journal';
  if (quickStatusOpen) return 'close-quick-status';
  return 'toggle-menu';
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

// Once the adventure menu CLOSES, keyboard focus should return to the
// expedition (document/body), not remain painted on the closed sapphire
// summary. Do not blur background controls or alter focus while opening.
// The next Tab is still caught by the game's normal menu shortcut.
export function chroniclesReleaseAdventureMenuFocus(menuDetails) {
  const active = menuDetails?.ownerDocument?.activeElement;
  if (!active || !menuDetails.contains(active) || typeof active.blur !== 'function') return false;
  active.blur();
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
