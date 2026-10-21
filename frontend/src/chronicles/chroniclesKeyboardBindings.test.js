import { describe, expect, it } from 'vitest';
import { CHRONICLES_DIRECTION_KEYS, chroniclesCombatKeyMode, chroniclesPartyHotkeyMember, chroniclesPartyHotkeySlots, CHRONICLES_PARTY_SLOT_IDS } from './chroniclesKeyboardBindings.js';

describe('Chronicles MM3 · keyboard movement and attack contract', () => {
  it('only four direction arrows move/turn the party', () => {
    expect(CHRONICLES_DIRECTION_KEYS).toEqual({
      ArrowUp: 'forward',
      ArrowDown: 'backward',
      ArrowLeft: 'turn-left',
      ArrowRight: 'turn-right',
    });
    expect(Object.keys(CHRONICLES_DIRECTION_KEYS)).toHaveLength(4);
    expect(CHRONICLES_DIRECTION_KEYS.a).toBeUndefined();
    expect(CHRONICLES_DIRECTION_KEYS.s).toBeUndefined();
  });
  it('A attacks in melee, S shoots, and Space retains optional auto attack', () => {
    for (const key of ['a', 'A']) expect(chroniclesCombatKeyMode(key)).toBe('melee');
    for (const key of ['s', 'S']) expect(chroniclesCombatKeyMode(key)).toBe('missile');
    expect(chroniclesCombatKeyMode(' ')).toBe('auto');
    for (const key of ['w', 'W', 'd', 'D', 'q', 'Q', 'e', 'E', ...Object.keys(CHRONICLES_DIRECTION_KEYS)]) {
      expect(chroniclesCombatKeyMode(key)).toBeNull();
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
