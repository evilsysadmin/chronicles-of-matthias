import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsInteractions, chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const DUNGEONS = ['salinas-hundidas', 'cueva-contrabandistas', 'minas-de-escoria', 'tumulos-primer-pacto', 'cienaga-negra'];

describe('Chronicles · Terra dungeons have something inside', () => {
  it.each(DUNGEONS)('%s: a note, a font, three traps, a chest, an elite and a boss in a sizeable maze', (id) => {
    const map = chroniclesMapById(id);
    expect(map.interactables.map((entry) => entry.id)).toEqual([`${id}-note`, `${id}-font`]);
    expect(map.traps).toHaveLength(3);
    // As long as Swordhaven's sewers: an expedition, not a corridor.
    expect(map.grid.join('').replace(/#/g, '').length).toBeGreaterThanOrEqual(200);
    expect(map.treasures.map((entry) => entry.id)).toEqual([`${id}-chest`, `${id}-cache`]);
    expect(map.enemies.length).toBeGreaterThanOrEqual(9);
    expect(map.enemies.filter((enemy) => enemy.defeatedFlag)).toHaveLength(2);
  });

  it.each(DUNGEONS)('%s: the elite carries the key that opens the sealed cache', (id) => {
    const map = chroniclesMapById(id);
    const cache = map.treasures.find((entry) => entry.id === `${id}-cache`);
    const keyId = cache.requirements[0].itemId;
    const elite = map.enemies.find((enemy) => enemy.id === `${id}-foe-8`);
    expect(elite.onDefeat.effects).toContainEqual(expect.objectContaining({ type: 'grant-item', itemId: keyId }));

    let state = { ...createChroniclesState(id), x: cache.x, y: cache.y };
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({ id: cache.id, locked: true }));
    state = chroniclesApplyContentEffects({ ...state, [elite.hpKey]: 0 }, elite.onDefeat.effects);
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({ id: cache.id, locked: false }));
    const opened = chroniclesTacticsUse(state, cache.id);
    expect(opened.inventory).not.toHaveProperty(keyId);
    expect(opened.xpAwards.map((award) => award.id)).toContain(`terra:${id}:cache:v1`);
    expect(chroniclesTacticsInteractions(opened).some((entry) => entry.id === cache.id)).toBe(false);
  });
});
