// One shared authority for town-counter opening and transactions. The entrance
// is the authored, walkable street tile; from the next tile a player must face
// it, with no interactions possible through an opaque wall or from afar.
const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 0 }),
]);

export function chroniclesTownCounterInReach(state, entry, map) {
  if (!state || !entry || !map || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) return false;
  // Stores have one physical entrance: do not open or trade from the street
  // tile behind it. Other counters retain their existing proximity rules.
  if (entry.shop) {
    if (entry.x !== state.x || entry.y !== state.y) return false;
    if (!String(entry.visualType || '').startsWith('building-')) return true;
    const facing = DIRECTIONS[state.direction];
    // The front wall is the shop's physical facade. Sideways or backwards
    // facing does not grant trade rights to a stale open dialog.
    return Boolean(facing && map.grid?.[state.y + facing.dy]?.[state.x + facing.dx] === '#');
  }
  if (entry.x === state.x && entry.y === state.y) return true;
  const direction = DIRECTIONS[state.direction];
  const tile = map.grid?.[entry.y]?.[entry.x];
  return Boolean(direction && tile && tile !== '#'
    && entry.x === state.x + direction.dx && entry.y === state.y + direction.dy);
}
