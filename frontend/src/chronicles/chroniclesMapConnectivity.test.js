import { describe, expect, it } from 'vitest';
import { chroniclesMapById, chroniclesMapContentPosition, chroniclesMapIds } from './chroniclesMapCatalog.js';

// Stepping on an exit leaves the map. If the only way between two parts of a
// map crosses an exit, the player is thrown out every time they try to
// reach the far side. Content must all lie in one region that never needs an
// exit cell to cross.
function regions(map) {
  const exits = new Set((map.exits || [])
    .map((exit) => chroniclesMapContentPosition(map, exit))
    .filter(Boolean)
    .map(({ x, y }) => `${x},${y}`));
  const region = new Map();
  let count = 0;
  map.grid.forEach((row, y) => [...row].forEach((cell, x) => {
    const key = `${x},${y}`;
    if (cell === '#' || exits.has(key) || region.has(key)) return;
    count += 1;
    region.set(key, count);
    const queue = [[x, y]];
    while (queue.length) {
      const [cx, cy] = queue.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const next = `${nx},${ny}`;
        const tile = map.grid[ny]?.[nx];
        if (tile === undefined || tile === '#' || exits.has(next) || region.has(next)) continue;
        region.set(next, count);
        queue.push([nx, ny]);
      }
    }
  }));
  return region;
}

describe('Chronicles map connectivity', () => {
  it.each(chroniclesMapIds())('%s keeps its content reachable without crossing an exit', (mapId) => {
    const map = chroniclesMapById(mapId);
    const region = regions(map);
    const content = ['enemies', 'interactables', 'treasures', 'triggers', 'traps']
      .flatMap((group) => map[group] || [])
      .map((entry) => ({ id: entry.id, position: chroniclesMapContentPosition(map, entry) }))
      .filter((entry) => entry.position && region.has(`${entry.position.x},${entry.position.y}`));
    const used = new Set(content.map((entry) => region.get(`${entry.position.x},${entry.position.y}`)));
    expect([...used], content.map((entry) => `${entry.id}→${region.get(`${entry.position.x},${entry.position.y}`)}`).join(' ')).toHaveLength(Math.min(1, used.size));
  });
  it.each(['crypt-eight-squares', 'gallery-of-forks', 'menagerie-of-ash', 'swordhaven-sewers'])(
    '%s keeps every dungeon encounter, pickup and exit walkable from its spawn',
    (mapId) => {
      const map = chroniclesMapById(mapId);
      const start = map.partyStart;
      expect(map.grid[start.y]?.[start.x], `${mapId} spawn must exist`).toBeDefined();
      expect(map.grid[start.y][start.x], `${mapId} spawn must be walkable`).not.toBe('#');
      const reachable = new Set([`${start.x},${start.y}`]);
      const queue = [[start.x, start.y]];
      for (const [x, y] of queue) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          if (map.grid[ny]?.[nx] === undefined || map.grid[ny][nx] === '#' || reachable.has(key)) continue;
          reachable.add(key);
          queue.push([nx, ny]);
        }
      }
      // The general connectivity check must not silently ignore content
      // placed inside walls or disconnected from the actual player spawn.
      for (const group of ['enemies', 'interactables', 'treasures', 'triggers', 'traps', 'exits']) {
        for (const entry of map[group] || []) {
          const position = chroniclesMapContentPosition(map, entry);
          expect(position, `${mapId}/${group}/${entry.id} needs a real tile`).toBeTruthy();
          expect(reachable.has(`${position.x},${position.y}`),
            `${mapId}/${group}/${entry.id} must be reachable from spawn`).toBe(true);
        }
      }
    },
  );

});
