import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

const COUNT_KEY = '__chrRuntime.automap.parts';
const PART_PREFIX = '__chrRuntime.automap.part.';
const PART_SIZE = 240;
const MAX_PARTS = 96;
const MAX_CELLS_PER_MAP = 4096;
const KNOWN_MAPS = new Map(chroniclesMapIds().map((id) => [id, chroniclesMapById(id)]));

// Two bits per cell preserve footsteps and observed walls independently.
// Hex stays portable in browsers and fits every current area inside the
// existing Go checkpoint limits (256 runes per flag, 128 KiB in total).
function encodeMap(map, cells) {
  const width = map.grid[0].length;
  const height = map.grid.length;
  if (width * height > MAX_CELLS_PER_MAP) throw new Error('El automapa supera el tamaño admitido.');
  const nibbles = new Uint8Array(Math.ceil(width * height / 2));
  for (const cell of cells) {
    const match = /^(\d+):(\d+)(:s)?$/.exec(String(cell));
    if (!match) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x >= width || y >= height) continue;
    const index = y * width + x;
    nibbles[Math.floor(index / 2)] |= (match[3] ? 2 : 1) << ((index % 2) * 2);
  }
  if (!nibbles.some(Boolean)) return null;
  return [map.id, width, height, Array.from(nibbles, (value) => value.toString(16)).join('')];
}

export function chroniclesAutomapCheckpointFlags(visitedByMap) {
  const source = visitedByMap && typeof visitedByMap === 'object' && !Array.isArray(visitedByMap)
    ? visitedByMap : {};
  const rows = Object.keys(source).sort().flatMap((id) => {
    const map = KNOWN_MAPS.get(id);
    if (!map || !Array.isArray(source[id])) return [];
    const row = encodeMap(map, source[id]);
    return row ? [row] : [];
  });
  const chars = Array.from(JSON.stringify([1, rows]));
  const count = Math.ceil(chars.length / PART_SIZE);
  if (count > MAX_PARTS) throw new Error('El automapa es demasiado grande para guardar.');
  // Persist an empty ledger too: it must outrank stale local geometry.
  const flags = { [COUNT_KEY]: count };
  for (let index = 0; index < count; index += 1) {
    flags[`${PART_PREFIX}${index}`] = chars.slice(index * PART_SIZE, (index + 1) * PART_SIZE).join('');
  }
  return flags;
}

// null means a legacy save without a durable automap; {} means a saved empty
// or damaged ledger. Only legacy saves may fall back to the old session cache.
export function chroniclesCheckpointAutomapVisited(run) {
  const flags = run?.worldFlags;
  if (!flags || !Object.hasOwn(flags, COUNT_KEY)) return null;
  const count = flags[COUNT_KEY];
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) return {};
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const part = flags[`${PART_PREFIX}${index}`];
    if (typeof part !== 'string' || !part.length || Array.from(part).length > PART_SIZE) return {};
    parts.push(part);
  }
  let decoded;
  try { decoded = JSON.parse(parts.join('')); } catch { return {}; }
  if (!Array.isArray(decoded) || decoded.length !== 2 || decoded[0] !== 1
    || !Array.isArray(decoded[1]) || decoded[1].length > KNOWN_MAPS.size) return {};
  const visited = {};
  const seenMaps = new Set();
  for (const row of decoded[1]) {
    if (!Array.isArray(row) || row.length !== 4) continue;
    const [id, width, height, hex] = row;
    const map = KNOWN_MAPS.get(id);
    if (!map || seenMaps.has(id) || width !== map.grid[0].length || height !== map.grid.length
      || width * height > MAX_CELLS_PER_MAP || typeof hex !== 'string'
      || hex.length !== Math.ceil(width * height / 2) || !/^[0-9a-f]+$/.test(hex)) continue;
    seenMaps.add(id);
    const cells = [];
    for (let index = 0; index < width * height; index += 1) {
      const bits = (Number.parseInt(hex[Math.floor(index / 2)], 16) >> ((index % 2) * 2)) & 3;
      const key = `${index % width}:${Math.floor(index / width)}`;
      if (bits & 1) cells.push(key);
      if (bits & 2) cells.push(`${key}:s`);
    }
    if (cells.length) visited[id] = cells;
  }
  return visited;
}
