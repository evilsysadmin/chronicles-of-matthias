import { describe, expect, it } from 'vitest';
import { chroniclesContextualContentAction, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesDoorwayPrompt } from './chroniclesDoorwayPrompt.js';

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
    // The authored outdoor altar remains an independent interaction underfoot.
    expect(oneBefore.contextual?.id).toBe('first-book-temple-altar');
    expect(oneBefore.npc).toBeNull();

    const atDoor = promptAt(state(14, 6, 1));
    expect(atDoor.npc?.name).toBe('Sacerdotisa Ilse');
    expect(promptAt(state(14, 6, 3)).npc).toBeNull();
  });

  it('requires the exact entry square and facade-facing orientation for each town business', () => {
    const doors = [...new Map(map.interactables.filter((entry) => (
      entry.shop || entry.guild || entry.visualType === 'building-tavern'
    )).map((entry) => [entry.x + ',' + entry.y, entry])).values()];
    expect(doors.length).toBeGreaterThanOrEqual(4);
    for (const entry of doors) {
      const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const facing = directions.findIndex(([dx, dy]) => map.grid[entry.y + dy]?.[entry.x + dx] === '#');
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

  it('preserves ordinary map content, not turning all prompts into door-only actions', () => {
    const sign = map.interactables.find((entry) => entry.visualType === 'signpost');
    expect(sign).toBeTruthy();
    const atSign = state(sign.x, sign.y, 0);
    const contextual = chroniclesContextualContentAction(atSign);
    expect(chroniclesDoorwayPrompt(atSign, contextual, null).contextual).toEqual(contextual);
  });
});
