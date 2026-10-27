import { describe, expect, it } from 'vitest';
import { CHRONICLES_DIRECTION_KEYS, chroniclesCombatKeyMode, chroniclesAdventureMenuShortcut, chroniclesAdventureTabClosesMenu, chroniclesContainAdventureMenuTab, chroniclesRestoreAdventureMenuFocus, chroniclesReleaseAdventureMenuFocus, chroniclesBlockAdventureMenuBackgroundEvent, chroniclesFirstPersonEscapeAction, chroniclesPartyHotkeyMember, chroniclesPartyHotkeySlots, CHRONICLES_PARTY_SLOT_IDS } from './chroniclesKeyboardBindings.js';

describe('Chronicles MM3 · keyboard movement and attack contract', () => {
  it('arrow keys move/turn and Q/E strafe without stealing attack keys', () => {
    expect(CHRONICLES_DIRECTION_KEYS).toEqual({
      ArrowUp: 'forward',
      ArrowDown: 'backward',
      ArrowLeft: 'turn-left',
      ArrowRight: 'turn-right',
      q: 'strafe-left',
      Q: 'strafe-left',
      e: 'strafe-right',
      E: 'strafe-right',
    });
    expect(Object.keys(CHRONICLES_DIRECTION_KEYS)).toHaveLength(8);
    expect(CHRONICLES_DIRECTION_KEYS.a).toBeUndefined();
    expect(CHRONICLES_DIRECTION_KEYS.s).toBeUndefined();
    expect(CHRONICLES_DIRECTION_KEYS[' ']).toBeUndefined();
  });
  it('A only attacks in combat; S shoots in exploration and combat; Space remains unbound', () => {
    for (const key of ['a', 'A']) {
      expect(chroniclesCombatKeyMode(key), key).toBeNull();
      expect(chroniclesCombatKeyMode(key, { inCombat: false }), key).toBeNull();
      expect(chroniclesCombatKeyMode(key, { inCombat: true }), key).toBe('melee');
    }
    for (const key of ['s', 'S']) {
      expect(chroniclesCombatKeyMode(key), key).toBe('missile');
      expect(chroniclesCombatKeyMode(key, { inCombat: true }), key).toBe('missile');
    }
    for (const key of ['b', 'B']) {
      expect(chroniclesCombatKeyMode(key, { inCombat: false }), key).toBeNull();
      expect(chroniclesCombatKeyMode(key, { inCombat: true }), key).toBe('block');
    }
    for (const key of [' ', 'Space', 'Spacebar', 'w', 'W', 'd', 'D', 'q', 'Q', 'e', 'E',
      ...Object.keys(CHRONICLES_DIRECTION_KEYS)]) {
      expect(chroniclesCombatKeyMode(key), key).toBeNull();
      expect(chroniclesCombatKeyMode(key, { inCombat: true }), key).toBeNull();
    }
  });
});

describe('Chronicles shared 1–4 hero hotkeys', () => {
  const party = ['matthias', 'rook', 'bishop', 'knight'].map((id) => ({ id }));
  const keyEvent = (key, patch = {}) => ({ key, target: { isContentEditable: false, closest: () => null }, ...patch });
  it('chooses one of four slots and ignores other keys', () => {
    for (let n = 1; n <= 4; n++) expect(chroniclesPartyHotkeyMember(keyEvent(String(n)), party)).toBe(party[n - 1]);
    for (const key of ['0', '5', 'ArrowUp', 's']) expect(chroniclesPartyHotkeyMember(keyEvent(key), party)).toBeNull();
    expect(chroniclesPartyHotkeyMember(keyEvent('4'), party.slice(0, 2))).toBeNull();
  });
  it('does not switch a hidden hero while the modal adventure menu or Q prompt owns focus', () => {
    for (let key = 1; key <= 4; key += 1) {
      const event = keyEvent(String(key));
      expect(chroniclesPartyHotkeyMember(event, party, { menuOpen: true })).toBeNull();
      expect(chroniclesPartyHotkeyMember(event, party, { menuOpen: false }))
        .toBe(party[key - 1]);
    }
    expect(chroniclesPartyHotkeyMember(keyEvent('1'), party)).toBe(party[0]);
  });

  it('preserves text fields, modifiers, consumed and repeated events', () => {
    for (const guard of ['defaultPrevented', 'repeat', 'isComposing', 'ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      expect(chroniclesPartyHotkeyMember(keyEvent('4', { [guard]: true }), party)).toBeNull();
    }
    expect(chroniclesPartyHotkeyMember(keyEvent('4', { target: { isContentEditable: true } }), party)).toBeNull();
    for (const selector of ['input', 'textarea', 'select', '[contenteditable]', '[role="textbox"]']) {
      expect(chroniclesPartyHotkeyMember(keyEvent('4', { target: { closest: (query) => query.includes(selector) ? {} : null } }), party)).toBeNull();
    }
  });
});

describe('Chronicles stable numerical party identity', () => {
  const party = [
    { id: 'knight', name: 'Faust' },
    { id: 'bishop', name: 'Aziz' },
    { id: 'matthias', name: 'Matthias' },
    { id: 'rook', name: 'Hildegard' },
  ];
  const key = (number) => ({
    key: String(number),
    target: { isContentEditable: false, closest: () => null },
  });
  it('always maps 1–4 to Matthias, Hildegard, Aziz, Faust despite reordered arrays', () => {
    expect(CHRONICLES_PARTY_SLOT_IDS).toEqual(['matthias', 'rook', 'bishop', 'knight']);
    for (let n = 1; n <= 4; n++) {
      expect(chroniclesPartyHotkeyMember(key(n), party)?.id).toBe(CHRONICLES_PARTY_SLOT_IDS[n - 1]);
    }
    const creator = party.map(({ id, ...hero }) => ({ ...hero, slotId: id }));
    expect(chroniclesPartyHotkeyMember(key(4), creator)?.slotId).toBe('knight');
  });
  it('never substitutes another hero for a missing canonical slot', () => {
    expect(chroniclesPartyHotkeyMember(key(4), party.filter((member) => member.id !== 'knight')))
      .toBeNull();
  });
  it('preserves the positional contract for noncanonical test/temporary rosters', () => {
    const custom = [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }, { id: 'delta' }];
    expect(chroniclesPartyHotkeyMember(key(4), custom).id).toBe('delta');
  });
});

describe('Chronicles shared party slot numbering', () => {
  const canonical = ['knight', 'bishop', 'matthias', 'rook']
    .map((id) => ({ id }));
  it('presents the same 1–4 slots as hotkeys, regardless of party array ordering', () => {
    expect(chroniclesPartyHotkeySlots(canonical).map(({ slot, member }) => [slot, member.id]))
      .toEqual([[1, 'matthias'], [2, 'rook'], [3, 'bishop'], [4, 'knight']]);
  });
  it('retains the fourth slot for Faust even with missing earlier members', () => {
    expect(chroniclesPartyHotkeySlots([{ id: 'knight' }, { id: 'matthias' }])
      .map(({ slot, member }) => [slot, member.id]))
      .toEqual([[1, 'matthias'], [4, 'knight']]);
  });
  it('accepts creator slot IDs and preserves fallback numbering', () => {
    expect(chroniclesPartyHotkeySlots([{ slotId: 'knight' }])[0].slot).toBe(4);
    expect(chroniclesPartyHotkeySlots([{ id: 'alpha' }, { id: 'beta' }])
      .map(({ slot }) => slot)).toEqual([1, 2]);
  });
});


describe('Chronicles adventure menu keyboard shortcuts', () => {
  const keyEvent = (key, patch = {}) => ({
    key, target: { isContentEditable: false, closest: () => null }, ...patch,
  });

  it('S saves and Q requests safe exit confirmation only while the adventure menu is open', () => {
    for (const key of ['s', 'S']) {
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), { menuOpen: true })).toBe('save');
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), { menuOpen: false })).toBeNull();
    }
    for (const key of ['q', 'Q']) {
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), { menuOpen: true })).toBe('request-exit');
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), { menuOpen: false })).toBeNull();
    }
    expect(chroniclesAdventureMenuShortcut(keyEvent('a'), { menuOpen: true })).toBeNull();
    expect(chroniclesCombatKeyMode('s')).toBe('missile'); // Exploration shooting stays intact.
    expect(CHRONICLES_DIRECTION_KEYS.q).toBe('strafe-left');
    expect(CHRONICLES_DIRECTION_KEYS.e).toBe('strafe-right');
    // The live key handler checks the adventure menu before directional movement.
  });

  it('never interprets S or Q as adventure actions while a nested folio page owns the menu', () => {
    const subpage = { menuOpen: true, subpageOpen: true };
    for (const key of ['s', 'S', 'q', 'Q']) {
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), subpage)).toBeNull();
      const buttonTarget = { isContentEditable: false, closest: () => null };
      expect(chroniclesAdventureMenuShortcut(keyEvent(key, { target: buttonTarget }), subpage)).toBeNull();
    }
    // The parent menu regains its shortcuts after the nested page closes.
    expect(chroniclesAdventureMenuShortcut(keyEvent('s'), { menuOpen: true })).toBe('save');
    expect(chroniclesAdventureMenuShortcut(keyEvent('q'), { menuOpen: true })).toBe('request-exit');
    // Escape first returns to the parent menu without closing the expedition.
    expect(chroniclesAdventureMenuShortcut(keyEvent('Escape'), subpage)).toBe('back-feedback');
    expect(chroniclesAdventureMenuShortcut(keyEvent('Escape'), {
      ...subpage, confirmExitWithoutSaving: true,
    })).toBe('cancel-exit');
  });

  it('Esc cancels an unsafe-exit confirmation first, then closes only the open menu', () => {
    const key = (patch = {}) => keyEvent('Escape', patch);
    expect(chroniclesAdventureMenuShortcut(key(), { menuOpen: true, confirmExitWithoutSaving: true }))
      .toBe('cancel-exit');
    expect(chroniclesAdventureMenuShortcut(key(), { menuOpen: true })).toBe('close');
    expect(chroniclesAdventureMenuShortcut(key(), { menuOpen: false })).toBeNull();
    expect(chroniclesAdventureMenuShortcut(key({ repeat: true }), { menuOpen: true })).toBeNull();
    expect(chroniclesAdventureMenuShortcut(key(), { menuOpen: true, saveBusy: true })).toBe('close');
    const volumeTarget = { isContentEditable: false, closest: () => ({ tagName: 'INPUT' }) };
    expect(chroniclesAdventureMenuShortcut(key({ target: volumeTarget }), { menuOpen: true }))
      .toBe('close');
    expect(chroniclesAdventureMenuShortcut(key({ target: volumeTarget }), {
      menuOpen: true, confirmExitWithoutSaving: true,
    })).toBe('cancel-exit');
    expect(chroniclesAdventureMenuShortcut(keyEvent('s', { target: volumeTarget }), { menuOpen: true }))
      .toBeNull();
    expect(chroniclesAdventureMenuShortcut(keyEvent('q', { target: volumeTarget }), { menuOpen: true }))
      .toBeNull();
    expect(chroniclesAdventureMenuShortcut(keyEvent('q'), { menuOpen: true, confirmExitWithoutSaving: true }))
      .toBeNull();
  });

  it('never saves twice, confirms exit by holding Q, or hijacks text and audio inputs', () => {
    const menuOpen = { menuOpen: true };
    for (const guard of ['repeat', 'defaultPrevented', 'isComposing', 'ctrlKey', 'altKey', 'metaKey']) {
      expect(chroniclesAdventureMenuShortcut(keyEvent('s', { [guard]: true }), menuOpen)).toBeNull();
      expect(chroniclesAdventureMenuShortcut(keyEvent('q', { [guard]: true }), menuOpen)).toBeNull();
    }
    for (const key of ['s', 'q']) {
      expect(chroniclesAdventureMenuShortcut(keyEvent(key), { menuOpen: true, saveBusy: true })).toBeNull();
      expect(chroniclesAdventureMenuShortcut(keyEvent(key),
        { menuOpen: true, confirmExitWithoutSaving: true })).toBeNull();
      expect(chroniclesAdventureMenuShortcut(keyEvent(key, { target: { isContentEditable: true } }), menuOpen)).toBeNull();
      expect(chroniclesAdventureMenuShortcut(keyEvent(key, {
        target: { closest: () => ({ tagName: 'INPUT' }) },
      }), menuOpen)).toBeNull();
    }
  });
});


describe('Chronicles pause menu · choose saved expedition', () => {
  const key = (keyName) => ({
    key: keyName, target: { isContentEditable: false, closest: () => null },
  });

  it('cancels the load decision on Esc without closing the adventure menu', () => {
    const confirm = { menuOpen: true, confirmLoadSelection: true };
    expect(chroniclesAdventureMenuShortcut(key('Escape'), confirm)).toBe('cancel-load');
    expect(chroniclesFirstPersonEscapeAction(confirm)).toBe('cancel-load');
    expect(chroniclesAdventureMenuShortcut(key('Escape'), { menuOpen: true })).toBe('close');
  });

  it('does not shoot, save, quit or close via Tab while choosing a saved game', () => {
    const confirm = { menuOpen: true, confirmLoadSelection: true };
    for (const name of ['s', 'S', 'q', 'Q']) {
      expect(chroniclesAdventureMenuShortcut(key(name), confirm)).toBeNull();
    }
    expect(chroniclesAdventureTabClosesMenu({
      key: 'Tab', target: {}, shiftKey: false, repeat: false,
    }, {}, confirm)).toBe(false);
    expect(chroniclesAdventureMenuShortcut(key('s'), { menuOpen: true })).toBe('save');
  });
});

describe('Chronicles modal adventure-menu Tab containment', () => {
  const setup = () => {
    const doc = { activeElement: null, defaultView: { getComputedStyle: () => ({ visibility: 'visible' }) } };
    const controls = Array.from({ length: 3 }, () => ({
      ownerDocument: doc,
      getClientRects: () => [1],
      getAttribute: () => null,
      closest: () => null,
      focus() { doc.activeElement = this; },
    }));
    const menu = { open: true, ownerDocument: doc, querySelectorAll: () => controls };
    const event = (shiftKey = false, key = 'Tab') => ({
      key, shiftKey, prevented: false,
      preventDefault() { this.prevented = true; },
    });
    return { doc, controls, menu, event };
  };

  it('wraps forwards from the final control to the opener and back with Shift+Tab', () => {
    const { doc, controls, menu, event } = setup();
    controls[2].focus();
    const forwards = event();
    expect(chroniclesContainAdventureMenuTab(forwards, menu)).toBe(true);
    expect(forwards.prevented).toBe(true);
    expect(doc.activeElement).toBe(controls[0]);
    const backwards = event(true);
    expect(chroniclesContainAdventureMenuTab(backwards, menu)).toBe(true);
    expect(backwards.prevented).toBe(true);
    expect(doc.activeElement).toBe(controls[2]);
  });

  it('traps focus within the exit question instead of allowing Tab into the mixer', () => {
    const { doc, controls, menu, event } = setup();
    const [unsafe, cancel] = controls.slice(0, 2);
    unsafe.textContent = 'Sí, salir sin guardar';
    cancel.textContent = 'Cancelar';
    const confirmation = { querySelectorAll: () => [unsafe, cancel] };
    menu.querySelector = () => confirmation;

    cancel.focus();
    const next = event();
    expect(chroniclesContainAdventureMenuTab(next, menu)).toBe(true);
    expect(doc.activeElement).toBe(unsafe);
    expect(next.prevented).toBe(true);

    const back = event(true);
    expect(chroniclesContainAdventureMenuTab(back, menu)).toBe(true);
    expect(doc.activeElement).toBe(cancel);

    // A stale focus left on a different menu control returns to Cancel.
    controls[2].focus();
    const stray = event();
    expect(chroniclesContainAdventureMenuTab(stray, menu)).toBe(true);
    expect(doc.activeElement).toBe(cancel);

    // Once the confirmation closes, original full-menu focus order resumes.
    menu.querySelector = () => null;
    cancel.focus();
    const fullMenu = event();
    expect(chroniclesContainAdventureMenuTab(fullMenu, menu)).toBe(false);
    expect(fullMenu.prevented).toBe(false);
  });

  it('keeps native Tab order intact between controls and while menu is closed', () => {
    const { doc, controls, menu, event } = setup();
    controls[1].focus();
    const interior = event();
    expect(chroniclesContainAdventureMenuTab(interior, menu)).toBe(false);
    expect(interior.prevented).toBe(false);
    expect(doc.activeElement).toBe(controls[1]);
    menu.open = false;
    controls[2].focus();
    const outside = event();
    expect(chroniclesContainAdventureMenuTab(outside, menu)).toBe(false);
    expect(outside.prevented).toBe(false);
    menu.open = true;
    const notTab = event(false, 's');
    expect(chroniclesContainAdventureMenuTab(notTab, menu)).toBe(false);
  });
});


describe('Chronicles adventure menu modal focus acquisition', () => {
  const setup = (confirm = false) => {
    const doc = { activeElement: null };
    const control = () => ({
      focus() { doc.activeElement = this; },
    });
    const summary = control();
    const cancel = control();
    const outside = control();
    const question = confirm ? { querySelector: () => cancel } : null;
    const details = {
      open: true,
      contains: (element) => element === summary || element === cancel,
      querySelector: (selector) => selector === 'summary' ? summary : question,
    };
    return { doc, details, summary, cancel, outside };
  };

  it('focuses the menu opener after a mouse/touch open with background focus', () => {
    const { doc, details, summary, outside } = setup();
    outside.focus();
    expect(chroniclesRestoreAdventureMenuFocus(details, doc.activeElement)).toBe(true);
    expect(doc.activeElement).toBe(summary);
    expect(chroniclesRestoreAdventureMenuFocus(details, doc.activeElement)).toBe(false);
  });

  it('returns stray background focus to Cancel while an unsafe exit is pending', () => {
    const { doc, details, cancel, outside } = setup(true);
    outside.focus();
    expect(chroniclesRestoreAdventureMenuFocus(details, doc.activeElement)).toBe(true);
    expect(doc.activeElement).toBe(cancel);
    expect(chroniclesRestoreAdventureMenuFocus(details, doc.activeElement)).toBe(false);
  });

  it('does not seize focus when the menu has already closed', () => {
    const { doc, details, outside } = setup();
    details.open = false;
    outside.focus();
    expect(chroniclesRestoreAdventureMenuFocus(details, doc.activeElement)).toBe(false);
    expect(doc.activeElement).toBe(outside);
  });
});


describe('Chronicles closed adventure-menu focus', () => {
  const fixture = () => {
    const doc = { activeElement: null };
    const element = () => ({
      focus() { doc.activeElement = this; },
      blur() { if (doc.activeElement === this) doc.activeElement = null; },
    });
    const summary = element();
    const menuButton = element();
    const outside = element();
    const menu = {
      ownerDocument: doc,
      contains: (target) => target === summary || target === menuButton,
    };
    return { doc, summary, menuButton, outside, menu };
  };

  it('releases the focused sapphire after Tab opens the menu and Esc closes it', () => {
    const { doc, menu, summary } = fixture();
    summary.focus();
    expect(doc.activeElement).toBe(summary);
    expect(chroniclesReleaseAdventureMenuFocus(menu)).toBe(true);
    expect(doc.activeElement).toBeNull();
    expect(chroniclesReleaseAdventureMenuFocus(menu)).toBe(false);
    // The next Tab can still reach the opener and render its focus ring.
    summary.focus();
    expect(doc.activeElement).toBe(summary);
  });

  it('releases focus from menu actions or audio controls after dismissal', () => {
    const { doc, menu, menuButton } = fixture();
    menuButton.focus();
    expect(chroniclesReleaseAdventureMenuFocus(menu)).toBe(true);
    expect(doc.activeElement).toBeNull();
  });

  it('never blurs an unrelated focused HUD control', () => {
    const { doc, menu, outside } = fixture();
    outside.focus();
    expect(chroniclesReleaseAdventureMenuFocus(menu)).toBe(false);
    expect(doc.activeElement).toBe(outside);
    expect(chroniclesReleaseAdventureMenuFocus(null)).toBe(false);
  });
});

describe('Chronicles adventure-menu modal pointer guard', () => {
  const eventFor = (inside) => ({
    target: { closest: (selector) => inside && selector === '.chronicles-game-menu' ? {} : null },
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  });

  it('prevents pointerdown/clicks on game HUD controls while the menu is open', () => {
    const event = eventFor(false);
    expect(chroniclesBlockAdventureMenuBackgroundEvent(event, true)).toBe(true);
    expect(event.prevented).toBe(true);
    expect(event.stopped).toBe(true);
  });

  it('preserves native click/drag behaviour inside the menu, including audio sliders', () => {
    const event = eventFor(true);
    expect(chroniclesBlockAdventureMenuBackgroundEvent(event, true)).toBe(false);
    expect(event.prevented).toBe(false);
    expect(event.stopped).toBe(false);
  });

  it('restores game controls as soon as the menu closes', () => {
    const event = eventFor(false);
    expect(chroniclesBlockAdventureMenuBackgroundEvent(event, false)).toBe(false);
    expect(event.prevented).toBe(false);
    expect(event.stopped).toBe(false);
  });
});


describe('Chronicles global Escape / browser Back overlay priority', () => {
  it('dismisses Magia/Objetos first and never toggles the adventure menu behind the folio', () => {
    expect(chroniclesFirstPersonEscapeAction({ spellMenuOpen: 'spells' })).toBe('close-spell');
    expect(chroniclesFirstPersonEscapeAction({ spellMenuOpen: 'items' })).toBe('close-spell');
    expect(chroniclesFirstPersonEscapeAction({ spellMenuOpen: 'items', automapOpen: true }))
      .toBe('close-spell');
    expect(chroniclesFirstPersonEscapeAction({ spellMenuOpen: false })).toBe('toggle-menu');
  });

  it('closes a merchant, guild or character dossier without opening a menu behind it', () => {
    expect(chroniclesFirstPersonEscapeAction({ innOpen: true })).toBe('close-inn');
    expect(chroniclesFirstPersonEscapeAction({ sheetOpen: true, innOpen: true })).toBe('close-sheet');
    expect(chroniclesFirstPersonEscapeAction({ shopOpen: true })).toBe('close-shop');
    expect(chroniclesFirstPersonEscapeAction({ guildOpen: true })).toBe('close-guild');
    expect(chroniclesFirstPersonEscapeAction({ sheetOpen: true })).toBe('close-sheet');
    // The dossier can overlay a shop counter. Closing it must not close the
    // underlying shop or accidentally display another adventure-menu layer.
    expect(chroniclesFirstPersonEscapeAction({ sheetOpen: true, shopOpen: true }))
      .toBe('close-sheet');
    expect(chroniclesFirstPersonEscapeAction({ sheetOpen: true, guildOpen: true }))
      .toBe('close-sheet');
    expect(chroniclesFirstPersonEscapeAction({ shopOpen: true, spellMenuOpen: 'items' }))
      .toBe('close-shop');
    expect(chroniclesFirstPersonEscapeAction({ guildOpen: true, spellMenuOpen: 'spells' }))
      .toBe('close-guild');
    expect(chroniclesFirstPersonEscapeAction({ sheetOpen: false, shopOpen: false, guildOpen: false }))
      .toBe('toggle-menu');
  });

  it('closes a visible admin/dialogue/map overlay before allowing the game menu to open', () => {
    expect(chroniclesFirstPersonEscapeAction({ adminOpen: true })).toBe('close-admin');
    expect(chroniclesFirstPersonEscapeAction({ audienceOpen: true })).toBe('close-audience');
    expect(chroniclesFirstPersonEscapeAction({ automapOpen: true })).toBe('close-automap');
    expect(chroniclesFirstPersonEscapeAction({ journalOpen: true })).toBe('close-journal');
    expect(chroniclesFirstPersonEscapeAction({ quickStatusOpen: true })).toBe('close-quick-status');
    expect(chroniclesFirstPersonEscapeAction({})).toBe('toggle-menu');
    expect(chroniclesFirstPersonEscapeAction({ menuOpen: true })).toBe('toggle-menu');
    expect(chroniclesFirstPersonEscapeAction({ menuOpen: true, feedbackOpen: true }))
      .toBe('back-feedback');
    expect(chroniclesFirstPersonEscapeAction({ menuOpen: true, feedbackOpen: true, journalOpen: true }))
      .toBe('back-feedback');
    expect(chroniclesFirstPersonEscapeAction({ menuOpen: false, feedbackOpen: true }))
      .toBe('toggle-menu');
  });

  it('cancels the pending dangerous Q confirmation before any other navigation', () => {
    expect(chroniclesFirstPersonEscapeAction({
      menuOpen: true, confirmExitWithoutSaving: true, feedbackOpen: true, spellMenuOpen: 'items',
    })).toBe('cancel-exit');
    expect(chroniclesFirstPersonEscapeAction({
      menuOpen: true, confirmExitWithoutSaving: true,
    })).toBe('cancel-exit');
    // An obsolete confirmation flag with an already closed menu must never
    // trigger a second exit confirmation or resurrect the game menu.
    expect(chroniclesFirstPersonEscapeAction({
      menuOpen: false, confirmExitWithoutSaving: true, adminOpen: true,
    })).toBe('close-admin');
  });
});

describe('Chronicles TAB toggle on the menu gem', () => {
  const gem = { tagName: 'SUMMARY' };
  const button = { tagName: 'BUTTON' };
  const event = (target = gem, patch = {}) => ({ key: 'Tab', target, ...patch });
  it('TAB on the focused gem closes the already-open menu, without shift or repeat', () => {
    expect(chroniclesAdventureTabClosesMenu(event(), gem, { menuOpen: true })).toBe(true);
    expect(chroniclesAdventureTabClosesMenu(event(), gem)).toBe(false);
    expect(chroniclesAdventureTabClosesMenu(event(button), gem, { menuOpen: true })).toBe(false);
    for (const guard of ['shiftKey', 'repeat', 'ctrlKey', 'altKey', 'metaKey', 'defaultPrevented']) {
      expect(chroniclesAdventureTabClosesMenu(event(gem, { [guard]: true }), gem,
        { menuOpen: true })).toBe(false);
    }
  });
  it('never dismisses a confirmation or feedback draft with TAB', () => {
    for (const active of [{ confirmExitWithoutSaving: true }, { feedbackOpen: true }]) {
      expect(chroniclesAdventureTabClosesMenu(event(), gem,
        { menuOpen: true, ...active })).toBe(false);
    }
  });
});
