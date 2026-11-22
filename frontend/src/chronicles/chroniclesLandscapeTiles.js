// Reusable *compositions*, not textured squares: a tile describes a group of
// rocks, vegetation and ridges occupying one EXISTING blocked world cell.
// Renderer instances the existing material/geometry families across all
// selected tiles. No collider or authored map entry is generated here.
//
// Keep recipes deliberately small and immutable. Additional biomes can adopt
// this catalog one at a time without disturbing Banner Road's authored art.
function tile(id, boulderCount, boulderSize, cragChance, bushChance) {
  return Object.freeze({ id, boulderCount, boulderSize, cragChance, bushChance });
}

export const CHRONICLES_LANDSCAPE_TILES = Object.freeze({
  hills: Object.freeze({
    // Walkable neighbours need a low silhouette and unobstructed sightline.
    verge: Object.freeze([
      tile('stony-verge', 2, 1.12, 0, 0.28),
      tile('scrub-verge', 1, 1.05, 0, 0.88),
    ]),
    // Deep blocked cells can rise into distinct rocky foothill formations.
    interior: Object.freeze([
      tile('broken-hillside', 2, 1.30, 0.35, 0.25),
      tile('mountain-spur', 2, 1.18, 1, 0.12),
      tile('scrub-slope', 1, 1.21, 0.42, 0.70),
    ]),
    // The existing non-colliding scenery margin is an ideal ridgeline.
    backdrop: Object.freeze([
      tile('high-ridge', 2, 1.58, 1, 0.12),
      tile('talus-ridge', 3, 1.38, 0.75, 0.18),
    ]),
  }),
});

// Stable world-coordinate selector: traversal order, reloads, device quality,
// and map IDs cannot reshuffle existing tiles.
function tileHash(x, y) {
  let h = Math.imul(x ^ 0x2c1b3c6d, 0x297a2d39)
    ^ Math.imul(y ^ 0x1b873593, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export function chroniclesLandscapeTileAt({ grid = [], biome, x, y, outside = false } = {}) {
  const catalog = CHRONICLES_LANDSCAPE_TILES[biome];
  if (!catalog || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  // Never add a tall tile on a traversable square (or a malformed map).
  if (!outside && grid[y]?.[x] !== '#') return null;

  const bordersWalkable = !outside && (
    grid[y - 1]?.[x] === '.' || grid[y + 1]?.[x] === '.'
    || grid[y]?.[x - 1] === '.' || grid[y]?.[x + 1] === '.'
  );
  const family = outside ? 'backdrop' : bordersWalkable ? 'verge' : 'interior';
  const recipes = catalog[family];
  const recipe = recipes[tileHash(x, y) % recipes.length];
  return Object.freeze({ ...recipe, family });
}
