import {
  STORAGE_SESSION,
  readJsonStorage,
  removeStorageItem,
  writeJsonStorage,
} from '../safeStorage.js';

const AUTOMAP_STORAGE_PREFIX = 'chess-study-chronicles-automap-v1:';

export function chroniclesAutomapCellKey(x, y) {
  return `${Number(x)}:${Number(y)}`;
}

function parseCellKey(key) {
  const [rawX, rawY] = String(key || '').split(':');
  const x = Number(rawX);
  const y = Number(rawY);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

export function chroniclesAutomapMarkVisited(visitedByMap, state) {
  if (!state?.mapId || !Number.isInteger(state.x) || !Number.isInteger(state.y)) {
    return visitedByMap || {};
  }

  const source = visitedByMap && typeof visitedByMap === 'object' ? visitedByMap : {};
  const visited = Array.isArray(source[state.mapId]) ? source[state.mapId] : [];
  const key = chroniclesAutomapCellKey(state.x, state.y);
  if (visited.includes(key)) return source;

  return {
    ...source,
    [state.mapId]: [...visited, key],
  };
}

// The automap remembers only geometry that entered the camera's field of view.
// MM3 rules: the map only learns what the company touches. The tile it
// stands on is recorded as visited; the walls around it (including the
// corners) are recorded as `x:y:s`. Nothing at a distance, not even straight
// ahead, so the map is earned step by step.
const SEEN_SUFFIX = ':s';

export function chroniclesAutomapMarkSeen(visitedByMap, map, state) {
  const marked = chroniclesAutomapMarkVisited(visitedByMap, state);
  if (!map?.grid || !state?.mapId) return marked;
  const visited = Array.isArray(marked[state.mapId]) ? marked[state.mapId] : [];
  const known = new Set(visited.map((key) => String(key).replace(SEEN_SUFFIX, '')));
  const seen = [...chroniclesAutomapTouchedCells(map, state)]
    .filter((key) => !known.has(key))
    .map((key) => `${key}${SEEN_SUFFIX}`);
  if (!seen.length) return marked;
  return { ...marked, [state.mapId]: [...visited, ...seen] };
}

export function chroniclesAutomapRevealedCells(map, visitedCells) {
  const revealed = new Set();
  const width = Number(map?.grid?.[0]?.length || 0);
  const height = Number(map?.grid?.length || 0);
  if (!width || !height) return revealed;

  // Previously, every recorded tile implicitly exposed its four neighbors.
  // That revealed passages behind corners even when the party had never seen
  // them. Explicit sight and footsteps are now the only sources of knowledge.
  (Array.isArray(visitedCells) ? visitedCells : []).forEach((key) => {
    const cell = parseCellKey(key);
    if (cell && cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height) {
      revealed.add(chroniclesAutomapCellKey(cell.x, cell.y));
    }
  });
  return revealed;
}

// The tile under the company and the walls that ring it. Open floor next
// to the company stays unknown until someone steps on it.
export function chroniclesAutomapTouchedCells(map, state) {
  const touched = new Set();
  const width = Number(map?.grid?.[0]?.length || 0);
  const height = Number(map?.grid?.length || 0);
  const x = Number(state?.x);
  const y = Number(state?.y);
  if (!width || !height || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
    return touched;
  }
  touched.add(chroniclesAutomapCellKey(x, y));
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const col = x + dx;
      const row = y + dy;
      if ((dx || dy) && map.grid[row]?.[col] === '#') touched.add(chroniclesAutomapCellKey(col, row));
    }
  }
  return touched;
}

// MM3-style position inside the current map: X grows east, Y grows north
// (0,0 is the south-west corner), so «X9 Y7» reads the way the old games did.
export function chroniclesMapCoordinates(map, state) {
  const height = Number(map?.grid?.length || 0);
  if (!height || !Number.isInteger(state?.x) || !Number.isInteger(state?.y)) return null;
  return { x: state.x, y: height - 1 - state.y };
}

export function chroniclesMapCoordinatesLabel(map, state) {
  const coords = chroniclesMapCoordinates(map, state);
  return coords ? `X${coords.x} Y${coords.y}` : '';
}

export function chroniclesAutomapFacingDegrees(direction) {
  const numeric = Number.isFinite(Number(direction)) ? Number(direction) : 0;
  const normalized = ((Math.trunc(numeric) % 4) + 4) % 4;
  return normalized * 90;
}


// Keep the ★ navigation hint visible when its known route step lies outside
// the explored-only automap viewport. Never extend/reveal map geometry for it.
// The arrow stays inside the SVG viewBox, inset enough to avoid being clipped.
export function chroniclesAutomapRouteEdge(viewport, state, target) {
  const values = [viewport?.x, viewport?.y, viewport?.width, viewport?.height,
    state?.x, state?.y, target?.x, target?.y];
  if (!values.every(Number.isFinite) || viewport.width <= 1.1 || viewport.height <= 1.1) return null;
  const inset = 0.55;
  const left = viewport.x + inset;
  const top = viewport.y + inset;
  const right = viewport.x + viewport.width - inset;
  const bottom = viewport.y + viewport.height - inset;
  const sx = state.x + 0.5;
  const sy = state.y + 0.5;
  const tx = target.x + 0.5;
  const ty = target.y + 0.5;
  // The party must actually be inside the viewport: no invented ray origin.
  if (sx < left || sx > right || sy < top || sy > bottom) return null;
  if (tx >= left && tx <= right && ty >= top && ty <= bottom) return null;
  const dx = tx - sx;
  const dy = ty - sy;
  const atX = dx > 0 ? (right - sx) / dx : dx < 0 ? (left - sx) / dx : Infinity;
  const atY = dy > 0 ? (bottom - sy) / dy : dy < 0 ? (top - sy) / dy : Infinity;
  const fraction = Math.min(atX, atY);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) return null;
  return {
    x: sx + dx * fraction,
    y: sy + dy * fraction,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
  };
}

function automapStorageKey(runId) {
  const safeRunId = typeof runId === 'string' ? runId.trim() : '';
  return safeRunId ? `${AUTOMAP_STORAGE_PREFIX}${safeRunId}` : '';
}

function normalizeVisitedLedger(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([mapId, cells]) => {
      if (typeof mapId !== 'string' || !mapId || !Array.isArray(cells)) return [];
      const normalized = [...new Set(
        cells
          .filter((cell) => /^-?\d+:-?\d+(:s)?$/.test(String(cell)))
          .map(String),
      )].slice(0, 4096);
      return normalized.length ? [[mapId, normalized]] : [];
    }),
  );
}

export function loadChroniclesAutomapVisited(runId) {
  const key = automapStorageKey(runId);
  if (!key) return {};
  return normalizeVisitedLedger(readJsonStorage(STORAGE_SESSION, key, {
    fallback: {},
    removeMalformed: true,
  }));
}

export function saveChroniclesAutomapVisited(runId, visitedByMap) {
  const key = automapStorageKey(runId);
  if (!key) return false;
  return writeJsonStorage(STORAGE_SESSION, key, normalizeVisitedLedger(visitedByMap));
}

export function clearChroniclesAutomapVisited(runId) {
  const key = automapStorageKey(runId);
  if (!key) return false;
  return removeStorageItem(STORAGE_SESSION, key);
}
