import { describe, expect, it, vi } from 'vitest';
import { chroniclesBindAreaTravelFocus, chroniclesAreaTravelKeyDecision } from './chroniclesAreaTransitionFocus.js';

function focusFixture() {
  const listeners = new Map();
  const doc = {
    activeElement: null,
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name);
    }),
  };
  const element = () => {
    const target = { isConnected: true };
    target.focus = vi.fn(() => {
      doc.activeElement = target;
      listeners.get('focusin')?.({ target });
    });
    return target;
  };
  const opener = element();
  const outside = element();
  const cancel = element();
  const accept = element();
  const dialog = {
    querySelector: vi.fn((selector) => selector === '[data-area-transition-cancel]' ? cancel : null),
    contains: (target) => target === cancel || target === accept,
  };
  doc.activeElement = opener;
  return { doc, listeners, opener, outside, cancel, accept, dialog };
}

describe('MM3 travel choice keyboard focus', () => {
  it('uses horizontal arrows for No/Yes and Enter for the focused choice', () => {
    expect(chroniclesAreaTravelKeyDecision('ArrowLeft', 'accept')).toBe('focus-cancel');
    expect(chroniclesAreaTravelKeyDecision('ArrowRight', 'cancel')).toBe('focus-accept');
    expect(chroniclesAreaTravelKeyDecision('Enter', 'cancel')).toBe('cancel');
    expect(chroniclesAreaTravelKeyDecision('Enter', 'accept')).toBe('accept');
    expect(chroniclesAreaTravelKeyDecision('Enter')).toBe('cancel');
    expect(chroniclesAreaTravelKeyDecision('Escape', 'accept')).toBe('cancel');
    expect(chroniclesAreaTravelKeyDecision('n')).toBe('cancel');
    expect(chroniclesAreaTravelKeyDecision('Y')).toBe('accept');
    expect(chroniclesAreaTravelKeyDecision('S')).toBe('accept');
    expect(chroniclesAreaTravelKeyDecision('Tab')).toBeNull();
    expect(chroniclesAreaTravelKeyDecision('ArrowUp')).toBeNull();
    expect(chroniclesAreaTravelKeyDecision('Control+Enter')).toBeNull();
  });
  it('focuses the safe No choice and restores the original HUD button afterward', () => {
    const { doc, opener, cancel, dialog, listeners } = focusFixture();
    const release = chroniclesBindAreaTravelFocus(dialog, doc);
    expect(doc.activeElement).toBe(cancel);
    expect(cancel.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(listeners.has('focusin')).toBe(true);
    release();
    expect(opener.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(doc.activeElement).toBe(opener);
    expect(listeners.has('focusin')).toBe(false);
  });

  it('keeps Tab or programmatic focus from escaping to an underlying HUD button', () => {
    const { doc, dialog, outside, cancel, accept } = focusFixture();
    const release = chroniclesBindAreaTravelFocus(dialog, doc);
    accept.focus();
    expect(doc.activeElement).toBe(accept);
    outside.focus();
    expect(doc.activeElement).toBe(cancel);
    release();
    outside.focus();
    expect(doc.activeElement).toBe(outside);
  });

  it('does not focus a removed opener after a confirmed map transition', () => {
    const { doc, dialog, opener, cancel } = focusFixture();
    const release = chroniclesBindAreaTravelFocus(dialog, doc);
    opener.isConnected = false;
    release();
    expect(opener.focus).not.toHaveBeenCalled();
    expect(doc.activeElement).toBe(cancel);
  });

  it('does not restore an element from inside a replaced dialog', () => {
    const { doc, dialog, accept, opener } = focusFixture();
    doc.activeElement = accept;
    const release = chroniclesBindAreaTravelFocus(dialog, doc);
    release();
    expect(accept.focus).not.toHaveBeenCalled();
    expect(opener.focus).not.toHaveBeenCalled();
  });
});
