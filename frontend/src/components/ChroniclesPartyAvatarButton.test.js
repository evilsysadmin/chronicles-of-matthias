import { describe, expect, it } from 'vitest';
import { chroniclesSecondTouchOpensSheet } from './ChroniclesPartyAvatarButton.jsx';

describe('Chronicles portrait touch selection', () => {
  it('opens on the second touch of an already selected portrait, without a time limit', () => {
    expect(chroniclesSecondTouchOpensSheet({
      touch: true, previouslyTouched: true, selected: true,
    })).toBe(true);
  });

  it('keeps first touch and switching portraits as selection, never opening a stale folio', () => {
    expect(chroniclesSecondTouchOpensSheet({
      touch: true, previouslyTouched: false, selected: true,
    })).toBe(false);
    expect(chroniclesSecondTouchOpensSheet({
      touch: true, previouslyTouched: true, selected: false,
    })).toBe(false);
  });

  it('does not treat a subsequent mouse or keyboard click as a touch second tap', () => {
    expect(chroniclesSecondTouchOpensSheet({
      touch: false, previouslyTouched: true, selected: true,
    })).toBe(false);
  });
});
