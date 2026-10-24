// One shared authority for town-counter opening and transactions. The entrance
// is the authored, walkable street tile; from the next tile a player must face
// it, with no interactions possible through an opaque wall or from afar.
const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 0 }),
]);

// The marked, walkable entrance square is the only place where a town house
// can be entered or used; merely seeing its facade is not sufficient.
export function chroniclesTownBuildingAtDoor(state, entry, map) {
  if (!state || !entry || !map
    || !String(entry.visualType || '').startsWith('building-')
    || entry.x !== state.x || entry.y !== state.y) return false;
  const facing = DIRECTIONS[state.direction];
  return Boolean(facing && map.grid?.[state.y + facing.dy]?.[state.x + facing.dx] === '#');
}

export function chroniclesTownCounterInReach(state, entry, map) {
  if (!state || !entry || !map || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) return false;
  // Buildings (shops, guilds, inns and audiences) share the same door
  // contract, including trade actions from an already open dialog.
  if (String(entry.visualType || '').startsWith('building-')) {
    return chroniclesTownBuildingAtDoor(state, entry, map);
  }
  if (entry.shop) return entry.x === state.x && entry.y === state.y;
  if (entry.x === state.x && entry.y === state.y) return true;
  const direction = DIRECTIONS[state.direction];
  const tile = map.grid?.[entry.y]?.[entry.x];
  return Boolean(direction && tile && tile !== '#'
    && entry.x === state.x + direction.dx && entry.y === state.y + direction.dy);
}
