import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesPartyBark } from '../chroniclesOfMatthiasBarks.js';

// Reported from a phone: the Swordhaven sewer grate "did nothing". It was
// locked until Aldric hands over the key, but the reason only reached the
// folded chronicle. A refused step now becomes a visible party remark.
describe('Chronicles refusal barks', () => {
  it('says why the sewer grate will not open', () => {
    const before = { ...createChroniclesState('swordhaven-first-book'), x: 13, y: 12, direction: 2 };
    const after = chroniclesReduce(before, 'forward');
    const bark = chroniclesPartyBark(before, after);
    expect(bark?.text).toMatch(/Aldric guarda la llave/);
  });

  it('stays quiet when the action works', () => {
    const atHall = { ...createChroniclesState('swordhaven-first-book'), x: 11, y: 10, direction: 2 };
    const talked = chroniclesReduce(atHall, 'interact');
    expect(talked.message).not.toBe(atHall.message);
    expect(chroniclesPartyBark(atHall, talked)).toBeNull();
  });

  it('stays quiet for walls and ordinary turns', () => {
    const before = { ...createChroniclesState('swordhaven-first-book'), x: 1, y: 1, direction: 0 };
    expect(chroniclesPartyBark(before, chroniclesReduce(before, 'forward'))).toBeNull();
    expect(chroniclesPartyBark(before, chroniclesReduce(before, 'turn-left'))).toBeNull();
  });
});
