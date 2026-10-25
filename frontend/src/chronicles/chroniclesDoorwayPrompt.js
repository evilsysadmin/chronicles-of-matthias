// Presentation-only gate for first-person town actions. Authored quest and
// counter rules remain unchanged; avoid advertising a doorway before the
// party actually stands in front of it.
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chroniclesSettlementLayout.js';

const DIRECTIONS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);
const canonicalDoors = new WeakMap();

function buildingDoorFacing(map, entry) {
  if (!map?.grid) return null;
  if (!canonicalDoors.has(map)) {
    const grid = map.grid;
    const width = Math.max(...grid.map((row) => row.length));
    const center = { x: (width - 1) / 2, y: (grid.length - 1) / 2 };
    const doors = new Map();
    for (const block of settlementHouseBlocks(grid, width, grid.length)) {
      const { door } = settlementHouseFacing(block, grid, center);
      const direction = DIRECTIONS.findIndex(([dx, dy]) =>
        block.cells.some((cell) => cell.x === door.x + dx && cell.y === door.y + dy));
      if (direction >= 0) doors.set(door.x + ',' + door.y, direction);
    }
    canonicalDoors.set(map, doors);
  }
  return canonicalDoors.get(map).get(entry.x + ',' + entry.y) ?? null;
}

export function chroniclesDoorwayPrompt(state, contextual, npc) {
  if (!state) return { contextual: null, npc: null };
  const map = chroniclesMapForState(state);
  const entryById = (id) => [...(map?.interactables || []), ...(map?.exits || [])]
    .find((entry) => entry.id === id);
  const available = (entry) => {
    if (!entry) return true; // Portals and other virtual actions have no map entry.
    // A coordinate-authored exit can be crossed by walking onto its tile,
    // but must not advertise a remote USAR from an adjacent empty square.
    if (entry.kind === 'exit' && Number.isInteger(entry.x) && Number.isInteger(entry.y)
      && (entry.x !== state.x || entry.y !== state.y)) return false;
    const building = String(entry.visualType || '').startsWith('building-');
    const doorway = building || Boolean(entry.shop || entry.guild);
    const townShrine = map?.regionKind === 'settlement' && entry.visualType === 'shrine';
    if (!doorway && !townShrine) return true;
    if (entry.x !== state.x || entry.y !== state.y) return false;
    if (!building) return true;
    const canonicalFacing = buildingDoorFacing(map, entry);
    if (canonicalFacing !== null) return state.direction === canonicalFacing;
    const dir = DIRECTIONS[state.direction];
    return Boolean(dir && map.grid?.[state.y + dir[1]]?.[state.x + dir[0]] === '#');
  };
  return {
    contextual: contextual && available(entryById(contextual.id)) ? contextual : null,
    npc: npc && available(entryById(npc.id)) ? npc : null,
  };
}
