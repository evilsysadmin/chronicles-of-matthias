import { describe, expect, it } from 'vitest';
import { chroniclesBuildingEntryState, chroniclesContextualContentAction,
  chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTownBuildingAtDoor, chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
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

describe('all Swordhaven house doors share a single contextual reach rule', () => {
  const map = chroniclesMapById('swordhaven-first-book');
  const base = createChroniclesState(map.id, null, { rules: 'mm3' });
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const buildings = [...new Map(map.interactables
    .filter(({ visualType }) => String(visualType || '').startsWith('building-'))
    .map((entry) => [entry.x + ',' + entry.y, entry])).values()];

  for (const entry of buildings) {
    it(`${entry.id}: no contextual door or transaction one square early or facing away`, () => {
      const direction = directions.findIndex(([dx, dy]) => map.grid[entry.y + dy]?.[entry.x + dx] === '#');
      expect(direction, entry.id).toBeGreaterThanOrEqual(0);
      const [dx, dy] = directions[direction];
      const atDoor = { ...base, x: entry.x, y: entry.y, direction };
      const preceding = { ...atDoor, x: entry.x - dx, y: entry.y - dy };
      const away = { ...atDoor, direction: (direction + 2) % 4 };
      expect(chroniclesTownBuildingAtDoor(atDoor, entry, map)).toBe(true);
      expect(chroniclesTownBuildingAtDoor(preceding, entry, map)).toBe(false);
      expect(chroniclesTownBuildingAtDoor(away, entry, map)).toBe(false);
      expect(chroniclesTownCounterInReach(preceding, entry, map)).toBe(false);
      expect(chroniclesContextualContentAction(preceding)?.id).not.toBe(entry.id);
      expect(chroniclesContextualContentAction(away)?.id).not.toBe(entry.id);
      expect(chroniclesNpcDialogueForState(preceding)).toBeNull();
      expect(chroniclesNpcDialogueForState(away)).toBeNull();
      if (entry.shop || entry.guild) {
        expect(chroniclesTownCounterInReach(atDoor, entry, map)).toBe(true);
        expect(chroniclesContextualContentAction(atDoor)?.id).toBe(entry.id);
      }
    });
  }

  it('temple: no phantom USAR two squares early; Ilse ENTER only at the door', () => {
    const twoBefore = { ...base, x: 12, y: 6, direction: 1 };
    const beforeDoor = { ...twoBefore, x: 13 };
    const onDoor = { ...twoBefore, x: 14 };
    expect(chroniclesContextualContentAction(twoBefore)?.id).not.toBe('first-book-temple-altar');
    expect(chroniclesNpcDialogueForState(twoBefore)).toBeNull();
    expect(chroniclesNpcDialogueForState(beforeDoor)).toBeNull();
    // The outdoor altar remains usable on its own authored square.
    expect(chroniclesContextualContentAction(beforeDoor)?.id).toBe('first-book-temple-altar');
    expect(chroniclesNpcDialogueForState(onDoor, chroniclesContextualContentAction(onDoor))?.name)
      .toBe('Sacerdotisa Ilse');
  });
});
