import { describe, expect, it } from 'vitest';
import { chroniclesBuildingEntryState, chroniclesContextualContentAction,
  chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('Swordhaven door: only the marked doorstep facing into the shop', () => {
  const map = chroniclesMapById('swordhaven-first-book');
  const odo = map.interactables.find(({ id }) => id === 'first-book-armorer');
  const state = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const at = (x, y, direction = 0) => ({ ...state(), x, y, direction });

  it('allows Odo at his actual door, never one street cell away or facing sideways', () => {
    expect(chroniclesTownCounterInReach(at(11, 4), odo, map)).toBe(true);
    for (const location of [at(11, 5), at(10, 4), at(12, 4),
      at(11, 4, 1), at(11, 4, 2), at(11, 4, 3)]) {
      expect(chroniclesTownCounterInReach(location, odo, map)).toBe(false);
      expect(chroniclesContextualContentAction(location)?.id).not.toBe(odo.id);
      expect(chroniclesBuildingEntryState(location)).toBeNull();
    }
    expect(chroniclesContextualContentAction(at(11, 4))?.id).toBe(odo.id);
  });

  it('needs one movement to reach the doorway, then F or facing-forward enters', () => {
    const approached = chroniclesReduce(at(11, 5), 'forward');
    expect([approached.x, approached.y]).toEqual([11, 4]);
    expect(approached.shop).toBeUndefined();
    expect(chroniclesReduce(at(11, 5), 'interact').shop).toBeUndefined();
    expect(chroniclesReduce(approached, 'interact').shop?.id).toBe(odo.id);
    expect(chroniclesReduce(at(11, 4), 'forward').shop?.id).toBe(odo.id);
  });

  it('does not teleport in when pushing the wall beside the actual doorway', () => {
    const side = at(10, 4);
    const bumped = chroniclesReduce(side, 'forward');
    expect(bumped.shop).toBeUndefined();
    expect([bumped.x, bumped.y]).toEqual([10, 4]);
    expect(bumped.message).toMatch(/puerta|pared|rodear/i);
    expect(chroniclesReduce(side, 'interact').shop).toBeUndefined();
  });
});
