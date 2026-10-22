import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsInteractions, chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesRunCheckpointPayload, chroniclesApplyRunCheckpoint } from './chroniclesRunCheckpoint.js';

const DUNGEONS = ['salinas-hundidas', 'cueva-contrabandistas', 'minas-de-escoria', 'tumulos-primer-pacto', 'cienaga-negra'];
// These four additional expedition maps share the same canonical Go generator.
const LARGE_DUNGEONS = [...DUNGEONS, 'cripta-del-obispo', 'faro-roto', 'guarida-del-dragon', 'torre-de-los-nombres'];

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

  it.each(LARGE_DUNGEONS)('%s: two spaced ordinary reinforcements preserve old foes, items and trapped corridors', (id) => {
    const map = chroniclesMapById(id);
    const expectedBefore = [0, 1, 2, 3, 10, 4, 11, 5, 12, 8, 9]
      .map((index) => `${id}-foe-${index}`);
    expect(map.enemies.map((enemy) => enemy.id)).toEqual([
      ...expectedBefore, `${id}-foe-13`, `${id}-foe-14`,
    ]);
    expect(new Set(map.enemies.map((enemy) => enemy.id)).size).toBe(13);
    expect(new Set(map.enemies.map((enemy) => enemy.hpKey)).size).toBe(13);
    const originals = map.enemies.slice(0, 11);
    const extra = map.enemies.slice(11);
    const key = ({ x, y }) => `${x},${y}`;
    const reserved = [map.partyStart, ...originals,
      ...['triggers', 'interactables', 'treasures', 'traps', 'exits']
        .flatMap((group) => map[group] || []),
    ].filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y));
    const occupied = new Set(reserved.map(key));
    const reached = new Set([key(map.partyStart)]);
    const queue = [map.partyStart];
    for (const { x, y } of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: x + dx, y: y + dy };
        if (map.grid[next.y]?.[next.x] === '.' && !reached.has(key(next))) {
          reached.add(key(next));
          queue.push(next);
        }
      }
    }
    const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const [index, enemy] of extra.entries()) {
      expect(map.grid[enemy.y][enemy.x], enemy.id).toBe('.');
      expect(reached.has(key(enemy)), enemy.id).toBe(true);
      expect(occupied.has(key(enemy)), enemy.id).toBe(false);
      expect(distance(enemy, map.partyStart), enemy.id).toBeGreaterThanOrEqual(5);
      expect(originals.concat(extra.slice(0, index))
        .every((old) => distance(enemy, old) >= 3), enemy.id).toBe(true);
      expect(enemy.optional, enemy.id).toBe(true);
      expect(enemy.activation, enemy.id).toBe('always');
      expect(enemy.defeatedFlag, enemy.id).toBeUndefined();
      expect(enemy.onDefeat.effects).toEqual([
        expect.objectContaining({ type: 'grant-gold' }),
      ]);
      expect(enemy.onDefeat.effects.filter((effect) => effect.type !== 'grant-gold')).toEqual([]);
      const speciesTemplate = originals.find((old) => old.id === `${id}-foe-${index + 3}`);
      expect(enemy.visualType, enemy.id).toBe(speciesTemplate.visualType);
      expect(enemy.ai, enemy.id).toEqual(speciesTemplate.ai);
      occupied.add(key(enemy));
    }
    const plotBearers = map.enemies.filter((enemy) => enemy.defeatedFlag).map((enemy) => enemy.id);
    expect(plotBearers).toEqual([`${id}-foe-8`, `${id}-foe-9`]);
    expect(map.traps).toHaveLength(3);
    expect(map.treasures).toHaveLength(2);
    expect(map.interactables).toHaveLength(2);
  });

  it.each(LARGE_DUNGEONS)('%s: added foes do not resurrect after leaving or loading a prior checkpoint', (id) => {
    const map = chroniclesMapById(id);
    for (const enemy of map.enemies.slice(11)) {
      const fresh = chroniclesMapTransitionState(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), id);
      expect(fresh[enemy.hpKey], enemy.id).toBeGreaterThan(0);
      const departed = chroniclesMapTransitionState(
        { ...fresh, [enemy.hpKey]: 0 }, 'swordhaven-first-book');
      const returned = chroniclesMapTransitionState(departed, id);
      expect(returned[enemy.hpKey], enemy.id).toBe(0);
      expect(returned[map.enemies[0].hpKey], id).toBeGreaterThan(0);
      const checkpoint = chroniclesRunCheckpointPayload(departed, 1);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        { ...checkpoint, worldVersion: 1 });
      const loaded = chroniclesMapTransitionState(restored, id);
      expect(loaded[enemy.hpKey], enemy.id).toBe(0);
      expect(loaded[map.enemies[0].hpKey], id).toBeGreaterThan(0);
    }
  });
});
