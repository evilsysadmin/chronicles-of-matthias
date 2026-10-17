// Terra at a glance: the 6×6 world (A–F × 1–6), what the company has seen
// of it, and where the current objective points. The objective's target is
// read from the quest text itself: every Terra objective names its place,
// usually with its area code ("Baja a las Salinas Hundidas (C6)").
import { chroniclesMapById, chroniclesMapContentPosition, chroniclesMapForState, chroniclesMapIds } from './chroniclesMapCatalog.js';
import { chroniclesRequirementsMet } from './chroniclesContentRuntime.js';

export const TERRA_COLUMNS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
export const TERRA_ROWS = Object.freeze([1, 2, 3, 4, 5, 6]);

let cachedIndex = null;

function transitionTarget(entry) {
  return (entry?.action?.effects || []).find((effect) => effect.type === 'transition-map')?.mapId || null;
}

function worldIndex() {
  if (cachedIndex) return cachedIndex;
  const maps = chroniclesMapIds().map((id) => chroniclesMapById(id));
  const byId = new Map(maps.map((map) => [map.id, map]));
  // A map without its own area code (Swordhaven, its sewers, the temple's
  // lower floors) belongs to the area its entrance stands in.
  const areaOf = new Map();
  maps.forEach((map) => { if (map.areaCode) areaOf.set(map.id, map.areaCode); });
  for (let pass = 0; pass < 4; pass += 1) {
    maps.forEach((map) => {
      if (areaOf.has(map.id)) return;
      const neighbour = (map.exits || []).map(transitionTarget).find((id) => id && areaOf.has(id));
      if (neighbour) areaOf.set(map.id, areaOf.get(neighbour));
    });
  }
  const places = new Map(); // area code → [{ id, title, kind }]
  maps.forEach((map) => {
    const code = areaOf.get(map.id);
    if (!code || map.id.startsWith('terra-')) return;
    const kind = map.regionKind === 'settlement' ? 'town' : map.regionKind === 'dungeon' ? 'dungeon' : 'road';
    if (!places.has(code)) places.set(code, []);
    places.get(code).push(Object.freeze({ id: map.id, title: map.title, kind }));
  });
  cachedIndex = { maps, byId, areaOf, places };
  return cachedIndex;
}

export function chroniclesAreaCodeForMap(mapId) {
  return worldIndex().areaOf.get(mapId) || null;
}

function normalise(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Where an objective sentence points: the map whose title it names (inside
 * the area code it gives, when it gives one), else that area's own map.
 */
export function chroniclesObjectiveDestination(objective) {
  const text = String(objective || '');
  if (!text) return null;
  const { maps, areaOf } = worldIndex();
  const code = text.match(/\(([A-F][1-6])\)/)?.[1] || null;
  const haystack = normalise(text);
  const named = maps
    .filter((map) => map.title && map.title.length > 3 && haystack.includes(normalise(map.title)))
    .filter((map) => !code || areaOf.get(map.id) === code)
    .sort((a, b) => b.title.length - a.title.length)[0];
  if (named) return Object.freeze({ mapId: named.id, code: areaOf.get(named.id) || code, title: named.title });
  if (!code) return null;
  const area = maps.find((map) => map.id === `terra-${code.toLowerCase()}`);
  return area ? Object.freeze({ mapId: area.id, code, title: area.title }) : null;
}

/** The first exit of the shortest open route from here to `targetMapId`. */
export function chroniclesRouteFirstExit(state, targetMapId) {
  const start = state?.mapId;
  if (!start || !targetMapId || start === targetMapId) return null;
  const { byId } = worldIndex();
  const previous = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const mapId = queue.shift();
    if (mapId === targetMapId) break;
    const map = byId.get(mapId);
    for (const exit of map?.exits || []) {
      const next = transitionTarget(exit);
      if (!next || previous.has(next) || !byId.has(next)) continue;
      // Only the current map's own locks are known to hold right now.
      if (mapId === start && !chroniclesRequirementsMet(state, exit.requirements)) continue;
      previous.set(next, { from: mapId, exit });
      queue.push(next);
    }
  }
  if (!previous.has(targetMapId)) return null;
  let node = targetMapId;
  while (previous.get(node)?.from !== start) node = previous.get(node).from;
  const { exit } = previous.get(node);
  const position = chroniclesMapContentPosition(byId.get(start), exit);
  return position ? Object.freeze({ exit, position, toMapId: node }) : null;
}

const SIDE_NAMES = Object.freeze({ N: 'norte', S: 'sur', E: 'este', W: 'oeste' });

/** A short, human route hint: where the next step of the way leaves from. */
export function chroniclesRouteHint(state, destination) {
  if (!destination || state?.mapId === destination.mapId) return null;
  const hop = chroniclesRouteFirstExit(state, destination.mapId);
  if (!hop) return null;
  const map = chroniclesMapForState(state);
  const width = map.grid[0]?.length || 1;
  const height = map.grid.length || 1;
  const { x, y } = hop.position;
  let side = null;
  if (y <= 1) side = 'N';
  else if (y >= height - 2) side = 'S';
  else if (x <= 1) side = 'W';
  else if (x >= width - 2) side = 'E';
  const label = hop.exit.openLabel || hop.exit.label || 'Salida';
  return Object.freeze({
    ...hop,
    text: side ? `${label} · por el ${SIDE_NAMES[side]}` : label,
  });
}

/** Everything the world map needs, as plain data. */
export function chroniclesWorldMapModel({ state, visitedMapIds = [], objective = '' }) {
  const { byId, places, areaOf } = worldIndex();
  const visited = new Set(visitedMapIds.map((id) => areaOf.get(id)).filter(Boolean));
  const here = areaOf.get(state?.mapId) || null;
  if (here) visited.add(here);
  const destination = chroniclesObjectiveDestination(objective);
  const cells = TERRA_ROWS.flatMap((row) => TERRA_COLUMNS.map((column) => {
    const code = `${column}${row}`;
    const area = byId.get(`terra-${code.toLowerCase()}`) || [...byId.values()].find((map) => map.areaCode === code && map.regionKind === 'wilderness');
    const seen = visited.has(code);
    const placesHere = (places.get(code) || []).filter((place) => place.kind !== 'road' && (seen || place.kind === 'town'));
    return Object.freeze({
      code,
      title: seen ? (area?.title || code) : null,
      biome: area?.biome || null,
      visited: seen,
      here: here === code,
      target: destination?.code === code,
      towns: placesHere.filter((place) => place.kind === 'town').map((place) => place.title),
      dungeons: seen ? placesHere.filter((place) => place.kind === 'dungeon').map((place) => place.title) : [],
    });
  }));
  return Object.freeze({ cells, here, destination });
}
