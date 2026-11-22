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

// A meadow 'tile' is a species composition rather than a square bitmap.
// Using the same 3x3-cell patch key gives continuous-looking herbaceous
// communities with sparse gaps; tiny per-cell offsets avoid a visible grid.
function meadowTile(id, coverage, tufts, flowerChance, herbChance) {
  return Object.freeze({ id, coverage, tufts, flowerChance, herbChance });
}

export const CHRONICLES_MEADOW_TILES = Object.freeze({
  // Broadleaf/fern margins near real impassable trees and rocks.
  edge: Object.freeze([
    meadowTile('fern-edge', 0.82, 2, 0.10, 0.48),
    meadowTile('scrub-grass', 0.77, 2, 0.14, 0.30),
    meadowTile('shade-meadow', 0.71, 1, 0.08, 0.43),
  ]),
  field: Object.freeze([
    meadowTile('low-pasture', 0.56, 1, 0.08, 0.02),
    meadowTile('flower-meadow', 0.67, 2, 0.38, 0.04),
    meadowTile('dry-tussocks', 0.48, 2, 0.12, 0.10),
    meadowTile('green-meadow', 0.72, 2, 0.20, 0.06),
  ]),
});

/**
 * Walkable meadow vegetation is optional, knee-low visual dressing.
 * Blocked terrain, authored road cells (filtered by caller), settlements
 * and other biomes never need this decorator. The patch selector depends
 * only on permanent grid coordinates, not render order or random runtime.
 */
export function chroniclesMeadowTileAt({ grid = [], biome, x, y } = {}) {
  if (biome !== 'plains' || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
    || grid[y]?.[x] !== '.') return null;
  const nearBlocked = grid[y - 1]?.[x] === '#' || grid[y + 1]?.[x] === '#'
    || grid[y]?.[x - 1] === '#' || grid[y]?.[x + 1] === '#';
  const family = nearBlocked ? 'edge' : 'field';
  const choices = CHRONICLES_MEADOW_TILES[family];
  const patch = choices[tileHash(Math.floor(x / 3), Math.floor(y / 3)) % choices.length];
  return Object.freeze({ ...patch, family });
}

// Foothill strips deliberately share the low-ground species already present
// elsewhere in Terra. Their recipes blend passable grassland into the real
// blocked ridgeline, never pretending that a decorative rock blocks movement.
function foothillTile(id, coverage, pebbles, grassChance) {
  return Object.freeze({ id, coverage, pebbles, grassChance });
}

export const CHRONICLES_FOOTHILL_TILES = Object.freeze({
  rockline: Object.freeze([
    foothillTile('broken-scree', 0.74, 2, 0.52),
    foothillTile('grassy-rockline', 0.70, 1, 0.82),
    foothillTile('wind-scoured-slope', 0.59, 3, 0.30),
  ]),
  upland: Object.freeze([
    foothillTile('short-upland-grass', 0.52, 0, 0.88),
    foothillTile('stony-pasture', 0.62, 1, 0.72),
    foothillTile('thin-scree', 0.43, 1, 0.34),
  ]),
});

export function chroniclesFoothillTileAt({ grid = [], biome, x, y } = {}) {
  if (biome !== 'hills' || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
    || grid[y]?.[x] !== '.') return null;
  const nearRock = grid[y - 1]?.[x] === '#' || grid[y + 1]?.[x] === '#'
    || grid[y]?.[x - 1] === '#' || grid[y]?.[x + 1] === '#';
  const family = nearRock ? 'rockline' : 'upland';
  const options = CHRONICLES_FOOTHILL_TILES[family];
  const recipe = options[tileHash(Math.floor(x / 3), Math.floor(y / 3)) % options.length];
  return Object.freeze({ ...recipe, family });
}
