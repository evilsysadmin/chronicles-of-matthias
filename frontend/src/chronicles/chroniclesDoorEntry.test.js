import { describe, expect, it } from 'vitest';
import { chroniclesBuildingEntryState, chroniclesContextualContentAction,
  chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('Swordhaven merchant doors have one accessible entrance', () => {
  const map = chroniclesMapById('swordhaven-first-book');
  const odo = map.interactables.find(({ id }) => id === 'first-book-armorer');
  const state = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const at = (x, y, direction = 0) => ({ ...state(), x, y, direction });

  it('Odo is reachable only on his actual marked door tile', () => {
    expect(chroniclesTownCounterInReach(at(11, 4), odo, map)).toBe(true);
    for (const location of [at(11, 5), at(10, 4), at(12, 4), at(10, 5), at(12, 5)]) {
      expect(chroniclesTownCounterInReach(location, odo, map)).toBe(false);
      expect(chroniclesContextualContentAction(location)?.id).not.toBe(odo.id);
      expect(chroniclesBuildingEntryState(location)).toBeNull();
    }
    expect(chroniclesContextualContentAction(at(11, 4))?.id).toBe(odo.id);
  });

  it('approach requires one step; F or bump-forward then enters Odo', () => {
    const approached = chroniclesReduce(at(11, 5), 'forward');
    expect([approached.x, approached.y]).toEqual([11, 4]);
    expect(approached.shop).toBeUndefined();
    expect(chroniclesReduce(at(11, 5), 'interact').shop).toBeUndefined();
    expect(chroniclesReduce(approached, 'interact').shop?.id).toBe(odo.id);
    expect(chroniclesReduce(at(11, 4), 'forward').shop?.id).toBe(odo.id);
  });

  it('walking toward a wall next to the entrance does not teleport inside', () => {
    const side = at(10, 4);
    const bumped = chroniclesReduce(side, 'forward');
    expect(bumped.shop).toBeUndefined();
    expect([bumped.x, bumped.y]).toEqual([10, 4]);
    expect(bumped.message).toMatch(/puerta|pared|rodear/i);
    expect(chroniclesReduce(side, 'interact').shop).toBeUndefined();
  });
});
