import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesRequirementsMet } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const indexGate = chroniclesMapById('blind-king-archive').interactables
  .find((entry) => entry.id === 'sealed-index');
const base = createChroniclesState('blind-king-archive', null, { rules: 'mm3' });

function withKeyCount(quantity) {
  return {
    ...base,
    inventory: { 'ivory-index-key': { id: 'ivory-index-key', quantity } },
  };
}

describe('MM3 dungeon item gates: saved inventory counts', () => {
  it('does not unlock the real Archive index with malformed or fractional key counts', () => {
    expect(indexGate).toBeDefined();
    for (const quantity of [
      undefined, null, false, true, [], [1], {}, '', ' ', 'Infinity',
      Infinity, NaN, -1, 0, 0.5, 1.5, Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(chroniclesRequirementsMet(withKeyCount(quantity), indexGate.when),
        `quantity ${String(quantity)} must not unlock the Archive`).toBe(false);
    }
    expect(chroniclesRequirementsMet(base, indexGate.when)).toBe(false);
  });

  it('accepts genuine whole key counts and legacy numeric strings', () => {
    for (const quantity of [1, 2, '1', '2']) {
      expect(chroniclesRequirementsMet(withKeyCount(quantity), indexGate.when)).toBe(true);
    }
    // The actual lever remains unavailable after it has already been used.
    expect(chroniclesRequirementsMet({
      ...withKeyCount('1'), archiveIndexUnlocked: true,
    }, indexGate.when)).toBe(false);
  });
});
