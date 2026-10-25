import { describe, expect, it } from 'vitest';
import { chroniclesContextualContentAction, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chroniclesSettlementLayout.js';
import { chroniclesDoorwayPrompt } from './chroniclesDoorwayPrompt.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';

const map = chroniclesMapById('swordhaven-first-book');
const state = (x, y, direction) => ({
  ...createChroniclesState(map.id),
  x, y, direction,
});
const promptAt = (s) => {
  const contextual = chroniclesContextualContentAction(s);
  return chroniclesDoorwayPrompt(s, contextual, chroniclesNpcDialogueForState(s, contextual));
};

describe('MM3 town contextual button proximity', () => {
  it('hides the far-away shrine and premature dialogue, showing Ilse only at her door', () => {
    const twoBefore = promptAt(state(12, 6, 1));
    expect(twoBefore.contextual?.id).not.toBe('first-book-temple-altar');
    expect(twoBefore.npc).toBeNull();

    const oneBefore = promptAt(state(13, 6, 1));
    // Facing the temple must not advertise either the altar or an early entrance.
    expect(oneBefore.contextual).toBeNull();
    expect(oneBefore.npc).toBeNull();
    // Turn away from the door: the authored outdoor altar is still usable
    // only while standing on its own square.
    expect(promptAt(state(13, 6, 0)).contextual?.id).toBe('first-book-temple-altar');

    const atDoor = promptAt(state(14, 6, 1));
    expect(atDoor.npc?.name).toBe('Sacerdotisa Ilse');
    expect(promptAt(state(14, 6, 3)).npc).toBeNull();
  });

  it('requires the exact entry square and facade-facing orientation for each town business', () => {
    const doors = [...new Map(map.interactables.filter((entry) => (
      entry.shop || entry.guild || entry.visualType === 'building-tavern'
    )).map((entry) => [entry.x + ',' + entry.y, entry])).values()];
    expect(doors.length).toBeGreaterThanOrEqual(4);
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const width = Math.max(...map.grid.map((row) => row.length));
    const center = { x: (width - 1) / 2, y: (map.grid.length - 1) / 2 };
    const houses = settlementHouseBlocks(map.grid, width, map.grid.length)
      .map((block) => ({ block, door: settlementHouseFacing(block, map.grid, center).door }));
    for (const entry of doors) {
      const house = houses.find(({ door }) => door.x === entry.x && door.y === entry.y);
      expect(house, entry.id).toBeTruthy();
      const facing = directions.findIndex(([dx, dy]) => house.block.cells
        .some((cell) => cell.x === entry.x + dx && cell.y === entry.y + dy));
      expect(facing, entry.id).toBeGreaterThanOrEqual(0);
      const [dx, dy] = directions[facing];
      const before = promptAt(state(entry.x - dx, entry.y - dy, facing));
      const onDoor = promptAt(state(entry.x, entry.y, facing));
      const lookingAway = promptAt(state(entry.x, entry.y, (facing + 2) % 4));
      expect(before.contextual?.id, entry.id).not.toBe(entry.id);
      expect(lookingAway.contextual?.id, entry.id).not.toBe(entry.id);
      expect(onDoor.contextual?.id, entry.id).toBe(entry.id);
    }
  });

  it('does not advertise a hidden sewer grate one square before its actual threshold', () => {
    const withKey = (x, y, direction = 1) => ({
      ...state(x, y, direction),
      inventory: { 'sewer-key': { id: 'sewer-key', quantity: 1, name: 'Llave' } },
    });
    const oneBefore = withKey(12, 13);
    expect(chroniclesContextualContentAction(oneBefore)?.id).toBe('swordhaven-to-sewers');
    expect(promptAt(oneBefore).contextual).toBeNull();
    expect(chroniclesAreaTransitionIntent(oneBefore, 'interact')).toBeNull();
    expect(chroniclesAreaTransitionIntent(oneBefore, 'forward')?.exitId).toBe('swordhaven-to-sewers');
    const underfoot = withKey(13, 13);
    expect(promptAt(underfoot).contextual?.id).toBe('swordhaven-to-sewers');
    expect(chroniclesAreaTransitionIntent(underfoot, 'interact')).toMatchObject({
      exitId: 'swordhaven-to-sewers', atThreshold: true,
    });
  });

  it('preserves ordinary map content, not turning all prompts into door-only actions', () => {
    const sign = map.interactables.find((entry) => entry.visualType === 'signpost');
    expect(sign).toBeTruthy();
    const atSign = state(sign.x, sign.y, 0);
    const contextual = chroniclesContextualContentAction(atSign);
    expect(chroniclesDoorwayPrompt(atSign, contextual, null).contextual).toEqual(contextual);
  });
});
