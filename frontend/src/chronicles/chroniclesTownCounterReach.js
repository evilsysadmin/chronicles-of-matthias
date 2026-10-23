// The shop/guild/inn counter is reachable only from its ACTUAL doorway.
// Do not trade from the neighboring street square or while facing away.
// The renderer's town buildings place their door on a walkable cell adjacent
// to a solid house footprint; the next cell must be the façade in front.
const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 0 }),
]);

export function chroniclesTownCounterInReach(state, entry, map) {
  if (!state || !entry || !map || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) return false;
  if (entry.x !== state.x || entry.y !== state.y) return false;
  if (!String(entry.visualType || '').startsWith('building-')) return true;
  const direction = DIRECTIONS[state.direction];
  return Boolean(direction && map.grid?.[state.y + direction.dy]?.[state.x + direction.dx] === '#');
}
