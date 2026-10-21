import { describe, expect, it } from 'vitest';
import { CHRONICLES_DIRECTION_KEYS, chroniclesCombatKeyMode, chroniclesPartyHotkeyMember } from './chroniclesKeyboardBindings.js';

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
