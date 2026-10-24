import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_DIRECTIONS,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chroniclesSettlementLayout.js';

// MM3 towns: you enter a building by walking into its door. The rules use the
// same layout the renderer draws, so for every styled house:
// - every house enters only from its single marked door, never its facade;
// - stepping into any other wall never opens a counter — let alone a
//   neighbour's — and points you to the door instead.

const mapFiles = import.meta.glob('./maps/*.json', { eager: true, import: 'default' });
const towns = Object.values(mapFiles)
  .map((manifest) => { try { return chroniclesMapById(manifest.id); } catch { return null; } })
  .filter(Boolean)
  .filter((map) => (map.interactables || []).some((entry) => String(entry.visualType || '').startsWith('building-')));

const directionTo = (dx, dy) => CHRONICLES_DIRECTIONS.findIndex((d) => d.dx === dx && d.dy === dy);

function houses(map) {
  const grid = map.grid;
  const width = Math.max(...grid.map((row) => row.length));
  const center = { x: (width - 1) / 2, y: (grid.length - 1) / 2 };
  return settlementHouseBlocks(grid, width, grid.length).map((block) => {
    const { door } = settlementHouseFacing(block, grid, center);
    const entries = (map.interactables || []).filter((entry) => entry.x === door.x && entry.y === door.y
      && String(entry.visualType || '').startsWith('building-'));
    return { block, door, entries };
  }).filter((house) => house.entries.length);
}

// Every open street cell touching the house, with the direction that faces it.
function approaches(map, block) {
  const cells = [];
  const open = (x, y) => map.grid[y]?.[x] === '.';
  for (let x = block.minX; x <= block.maxX; x += 1) {
    if (open(x, block.minY - 1)) cells.push({ x, y: block.minY - 1, direction: directionTo(0, 1) });
    if (open(x, block.maxY + 1)) cells.push({ x, y: block.maxY + 1, direction: directionTo(0, -1) });
  }
  for (let y = block.minY; y <= block.maxY; y += 1) {
    if (open(block.minX - 1, y)) cells.push({ x: block.minX - 1, y, direction: directionTo(1, 0) });
    if (open(block.maxX + 1, y)) cells.push({ x: block.maxX + 1, y, direction: directionTo(-1, 0) });
  }
  return cells;
}

function onDoorFacade(block, door, cell) {
  const horizontal = door.y === block.minY - 1 || door.y === block.maxY + 1;
  return horizontal
    ? cell.y === door.y && cell.x >= block.minX && cell.x <= block.maxX
    : cell.x === door.x && cell.y >= block.minY && cell.y <= block.maxY;
}

const walkInto = (map, cell) => chroniclesReduce(
  { ...createChroniclesState(map.id), x: cell.x, y: cell.y, direction: cell.direction, phase: 'explore', initiative: null },
  'forward',
);

describe('walking into town buildings', () => {
  for (const map of towns) {
    for (const { block, door, entries } of houses(map)) {
      const counter = entries.find((entry) => entry.shop || entry.guild);
      const name = `${map.id}: ${entries[0].id}`;

      it(`${name} — shop doors do not extend across the entire facade`, () => {
        const facade = approaches(map, block).filter((cell) => onDoorFacade(block, door, cell));
        expect(facade.length).toBeGreaterThan(0);
        for (const cell of facade) {
          const after = walkInto(map, cell);
          if (cell.x !== door.x || cell.y !== door.y) {
            expect(after.shop || after.guild).toBeFalsy();
            expect({ x: after.x, y: after.y }).toEqual({ x: cell.x, y: cell.y });
            expect(after.message || '').toMatch(/puerta|pared/i);
          } else if (counter) {
            expect(after.shop?.id || after.guild?.id, `from (${cell.x},${cell.y})`).toBe(counter.id);
            expect({ x: after.x, y: after.y }).toEqual(door);
          } else {
            expect(after.shop || after.guild).toBeFalsy();
            expect(after.message || '').not.toMatch(/Es la pared|a tu (derecha|izquierda)/);
          }
        }
      });

      it(`${name} — other walls never open a counter and point to the door`, () => {
        for (const cell of approaches(map, block).filter((c) => !onDoorFacade(block, door, c))) {
          const after = walkInto(map, cell);
          expect(after.shop || after.guild, `from (${cell.x},${cell.y})`).toBeFalsy();
          expect({ x: after.x, y: after.y }).toEqual({ x: cell.x, y: cell.y });
          expect(after.message || '').toMatch(/Es la pared|La puerta de/);
        }
      });
    }
  }
});

describe('Swordhaven shops a player reported', () => {
  const map = chroniclesMapById('swordhaven-first-book');
  for (const [id, x, y] of [
    ['first-book-guild', 14, 4], ['first-book-guild', 15, 4], ['first-book-guild', 16, 4],
    ['first-book-weaponsmith', 6, 4], ['first-book-weaponsmith', 7, 4], ['first-book-weaponsmith', 8, 4],
    ['first-book-armorer', 10, 4], ['first-book-armorer', 11, 4], ['first-book-armorer', 12, 4],
  ]) {
    it(`${id} walking north from (${x},${y}) respects the shop door`, () => {
      const after = walkInto(map, { x, y, direction: directionTo(0, -1) });
      const isShop = id !== 'first-book-guild';
      if (isShop && x !== (id === 'first-book-weaponsmith' ? 7 : 11)) {
        expect(after.shop?.id).toBeUndefined();
        expect([after.x, after.y]).toEqual([x, y]);
      } else {
        expect(after.shop?.id || after.guild?.id).toBe(id);
      }
    });
  }

  it('walking into the temple from the guild doorway does not open the guild', () => {
    const after = walkInto(map, { x: 15, y: 4, direction: directionTo(0, 1) });
    expect(after.guild).toBeFalsy();
    expect(after.message).toMatch(/Templo/);
  });
});

describe('UI audience entry state', () => {
  it('maps a facade cell to the door cell, and nothing elsewhere', async () => {
    const { chroniclesBuildingEntryState } = await import('../chroniclesOfMatthias.js');
    const base = { ...createChroniclesState('swordhaven-first-book'), phase: 'explore', initiative: null };
    // Ayuntamiento (Aldric) door is (11,10); facade x 10..12 seen from row 10 facing south.
    const side = chroniclesBuildingEntryState({ ...base, x: 10, y: 10, direction: directionTo(0, 1) });
    expect(side && { x: side.x, y: side.y }).toEqual({ x: 11, y: 10 });
    expect(chroniclesBuildingEntryState({ ...base, x: 9, y: 7, direction: directionTo(0, -1) })).toBeNull();
  });
});
