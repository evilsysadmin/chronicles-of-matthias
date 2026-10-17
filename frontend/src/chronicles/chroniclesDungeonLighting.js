// Where the light comes from in a generated dungeon: wall torches spread
// evenly over the whole maze (not only near the entrance) and braziers that
// mark where the elite and the boss wait. Pure data; the renderer turns each
// placement into a flame and lends it one of a few pooled lights when the
// party is near, so the cost does not grow with the size of the dungeon.

function hash(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const SIDE_STEP = Object.freeze({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] });
const OPPOSITE = Object.freeze({ north: 'south', east: 'west', south: 'north', west: 'east' });

/**
 * @param {Array<{x:number,y:number,side:string}>} wallFaces faces of '#' cells that look onto floor
 * @returns {Array<{x,y,side,intensity,flameScale}>}
 */
export function chroniclesSpreadTorchPlacements(wallFaces = [], { spacing = 3, max = 40 } = {}) {
  const ordered = [...wallFaces].sort((a, b) => hash(a.x, a.y, a.side.length) - hash(b.x, b.y, b.side.length));
  const chosen = [];
  for (const face of ordered) {
    if (chosen.length >= max) break;
    const [dx, dy] = SIDE_STEP[face.side] || [0, 0];
    const lit = { x: face.x + dx, y: face.y + dy };
    if (chosen.some((other) => Math.max(Math.abs(other.lit.x - lit.x), Math.abs(other.lit.y - lit.y)) < spacing)) continue;
    chosen.push({ face, lit });
  }
  // The renderer mounts a torch on a wall *of a floor cell* (`side` is the
  // wall it hangs on). Wall faces are given from the wall's point of view,
  // so turn each round: mounted on the wall cell itself, the flame sat
  // inside the stone and no generated dungeon ever showed a torch.
  return chosen.map(({ face, lit }, index) => Object.freeze({
    x: lit.x,
    y: lit.y,
    side: OPPOSITE[face.side],
    intensity: 0.85 + hash(face.x, face.y, 5) * 0.3,
    flameScale: 0.95 + (index % 2) * 0.12,
  }));
}

/**
 * Braziers stand by the elite and the boss: a warm landmark the party sees
 * before the fight, against the wall of the creature's starting cell.
 */
export function chroniclesBrazierPlacements(grid = [], enemies = []) {
  const out = [];
  for (const enemy of enemies) {
    if (!/-foe-[89]$/.test(String(enemy?.id || ''))) continue;
    const walls = Object.entries(SIDE_STEP).filter(([, [dx, dy]]) => grid[enemy.y + dy]?.[enemy.x + dx] === '#');
    if (!walls.length) continue;
    const [side, [dx, dy]] = walls[Math.floor(hash(enemy.x, enemy.y, 9) * walls.length)];
    out.push(Object.freeze({ x: enemy.x, y: enemy.y, side, dx, dy, boss: /-foe-9$/.test(enemy.id) }));
  }
  return out;
}

/** The `count` light sources nearest to (x, z), by squared distance. */
export function chroniclesNearestLightSources(sources, x, z, count) {
  return sources
    .map((source, index) => ({ index, d: (source.x - x) ** 2 + (source.z - z) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ index }) => index);
}
