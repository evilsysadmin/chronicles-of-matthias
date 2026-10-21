import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById, chroniclesMapContentPosition } from './chroniclesMapCatalog.js';

const TARGETS = Object.freeze({
  'swordhaven-first-book': 4,
  'banner-road-first-book': 7,
  'rookwood-first-book': 7,
});

function reachableCells(map) {
  const queue = [map.partyStart];
  const seen = new Set([`${map.partyStart.x},${map.partyStart.y}`]);
  for (let i = 0; i < queue.length; i += 1) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (map.grid[ny]?.[nx] === '#' || !map.grid[ny]?.[nx] || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe('First Book MM3 encounter density', () => {
  it.each(Object.entries(TARGETS))('%s has actual distinct active encounters, not decorative sprites (%i)', (id, minimum) => {
    const map = chroniclesMapById(id);
    const state = createChroniclesState(id);
    expect(map.enemies.length).toBeGreaterThanOrEqual(minimum);
    expect(chroniclesActiveEnemies(state)).toHaveLength(map.enemies.length);
    expect(new Set(map.enemies.map((enemy) => enemy.id)).size).toBe(map.enemies.length);
    expect(new Set(map.enemies.map((enemy) => enemy.hpKey)).size).toBe(map.enemies.length);

    const reachable = reachableCells(map);
    const occupied = new Set();
    const reserved = new Set([
      ...map.exits, ...map.interactables, ...map.treasures, ...map.traps, ...map.triggers,
    ].map((entry) => chroniclesMapContentPosition(map, entry))
      .filter(Boolean).map((point) => `${point.x},${point.y}`));
    for (const enemy of map.enemies) {
      const key = `${enemy.x},${enemy.y}`;
      expect(reachable.has(key), `${id}:${enemy.id} unreachable`).toBe(true);
      expect(occupied.has(key), `${id}:${enemy.id} overlaps enemy`).toBe(false);
      expect(reserved.has(key), `${id}:${enemy.id} occupies authored content`).toBe(false);
      expect(Math.abs(enemy.x - map.partyStart.x) + Math.abs(enemy.y - map.partyStart.y))
        .toBeGreaterThanOrEqual(3);
      occupied.add(key);
    }
  });

  it('preserves named quest targets and their unique rewards', () => {
    const road = chroniclesMapById('banner-road-first-book');
    const captain = road.enemies.find((enemy) => enemy.id === 'banner-road-bandit-captain');
    expect(captain?.onDefeat?.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'grant-item', itemId: 'tampered-route' }),
    ]));
    expect(road.enemies.filter((enemy) => (enemy.onDefeat?.effects || [])
      .some((effect) => effect.itemId === 'tampered-route'))).toHaveLength(1);

    const forest = chroniclesMapById('rookwood-first-book');
    const weaver = forest.enemies.find((enemy) => enemy.id === 'rookwood-weaver');
    expect(weaver?.onDefeat?.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'grant-item', itemId: 'weaver-silk' }),
    ]));
    expect(forest.enemies.filter((enemy) => (enemy.onDefeat?.effects || [])
      .some((effect) => effect.itemId === 'weaver-silk'))).toHaveLength(1);
  });

  it('keeps the town less hostile than the road/forest and conserves low-level danger', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const road = chroniclesMapById('banner-road-first-book');
    const forest = chroniclesMapById('rookwood-first-book');
    expect(town.enemies.length).toBeLessThan(road.enemies.length);
    expect(town.enemies.length).toBeLessThan(forest.enemies.length);
    for (const enemy of [...town.enemies, ...road.enemies, ...forest.enemies]) {
      if (!enemy.id.includes('captain')) expect(enemy.enemyBuild.level).toBe(1);
    }
  });
});
