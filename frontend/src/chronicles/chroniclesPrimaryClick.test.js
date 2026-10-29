import { describe, expect, it, vi } from 'vitest';
import {
  chroniclesBlockNonPrimaryClick,
  chroniclesPreventNativeContextMenu,
} from './chroniclesPrimaryClick.js';

function simulatedEvent(button) {
  return {
    button,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

describe('Chronicles primary-button-only input', () => {
  it('allows left mouse clicks and primary pen/touch presses unchanged', () => {
    const event = simulatedEvent(0);
    expect(chroniclesBlockNonPrimaryClick(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4])('blocks non-primary button %i before any game action', (button) => {
    const event = simulatedEvent(button);
    expect(chroniclesBlockNonPrimaryClick(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it('does not interfere with keyboard-triggered events without a button', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    expect(chroniclesBlockNonPrimaryClick(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('suppresses native context menus on game images, canvas and controls', () => {
    const event = simulatedEvent(2);
    chroniclesPreventNativeContextMenu(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });
});
