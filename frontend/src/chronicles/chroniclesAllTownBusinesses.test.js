import { describe, expect, it } from 'vitest';
import {
  chroniclesBuildingEntryState,
  chroniclesContextualContentAction,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesDoorwayPrompt } from './chroniclesDoorwayPrompt.js';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chroniclesSettlementLayout.js';
import { chroniclesShopStock } from './chroniclesShops.js';
import { chroniclesIsInn } from './chroniclesInns.js';
import { chroniclesTownCounterInReach } from './chroniclesTownCounterReach.js';

const directions = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
];

const businesses = chroniclesMapIds().flatMap((mapId) => {
  const map = chroniclesMapById(mapId);
  const width = Math.max(...map.grid.map((row) => row.length));
  const center = { x: (width - 1) / 2, y: (map.grid.length - 1) / 2 };
  const doors = settlementHouseBlocks(map.grid, width, map.grid.length)
    .map((block) => ({ block, door: settlementHouseFacing(block, map.grid, center).door }));
  return (map.interactables || []).filter((entry) => (
    entry.shop || entry.guild || chroniclesIsInn(entry)
  )).map((entry) => {
    const door = doors.find((house) => house.door.x === entry.x && house.door.y === entry.y);
    const direction = door
      ? directions.findIndex(({ dx, dy }) => door.block.cells.some(
        (cell) => cell.x === entry.x + dx && cell.y === entry.y + dy,
      ))
      : directions.findIndex(({ dx, dy }) => map.grid[entry.y + dy]?.[entry.x + dx] === '#');
    return { map, entry, door, direction };
  });
});

function atBusiness({ map, entry, direction }) {
  return {
    ...createChroniclesState(map.id, null, { rules: 'mm3' }),
    x: entry.x, y: entry.y, direction,
    phase: 'explore', initiative: null,
  };
}

describe('Chronicles · every authored town merchant and inn must open', () => {
  it('actually audits a large number of businesses, including the full Swordhaven', () => {
    expect(businesses.length).toBeGreaterThanOrEqual(35);
    for (const id of ['swordhaven-first-book', 'pinohelado', 'vado-de-sal']) {
      expect(businesses.some(({ map }) => map.id === id), id).toBe(true);
    }
  });

  it.each(businesses)('$map.id/$entry.id — shown door, contextual USAR and reducer agree', (business) => {
    const { map, entry, door, direction } = business;
    expect(map.grid[entry.y]?.[entry.x], entry.id).toBe('.');
    expect(direction, entry.id).toBeGreaterThanOrEqual(0);
    if (String(entry.visualType || '').startsWith('building-')) {
      expect(door, entry.id + ' must be aligned with the rendered facade').toBeTruthy();
    }
    const state = atBusiness(business);
    const expected = entry.shop ? 'shop' : entry.guild ? 'guild' : 'inn';
    const contextual = chroniclesContextualContentAction(state);
    expect(contextual?.id, entry.id + ' must be discoverable').toBe(entry.id);
    const offered = chroniclesDoorwayPrompt(state, contextual, null);
    expect(offered.contextual?.id, entry.id + ' must offer USAR at its real doorway').toBe(entry.id);
    if (door) expect(chroniclesBuildingEntryState(state)).toMatchObject({ x: entry.x, y: entry.y });
    const interacted = chroniclesReduce(state, 'interact');
    expect(interacted[expected]?.id, entry.id + ' must open its real interior').toBe(entry.id);
    const stepped = chroniclesReduce(state, 'forward');
    if (door) expect(stepped[expected]?.id, entry.id + ' must also open on forward bump').toBe(entry.id);
    if (entry.shop) expect(chroniclesTownCounterInReach(interacted, entry, map)).toBe(true);
    const facingAway = { ...state, direction: (direction + 2) % 4 };
    const hidden = chroniclesDoorwayPrompt(facingAway, chroniclesContextualContentAction(facingAway), null);
    if (door) expect(hidden.contextual?.id, entry.id + ' must not open backwards').not.toBe(entry.id);
    if (door) {
      const { dx, dy } = directions[direction];
      const oneBefore = { ...state, x: entry.x - dx, y: entry.y - dy };
      if (map.grid[oneBefore.y]?.[oneBefore.x] === '.') {
        const premature = chroniclesDoorwayPrompt(
          oneBefore, chroniclesContextualContentAction(oneBefore), null,
        );
        expect(premature.contextual?.id, entry.id + ' must not advertise from the next street tile')
          .not.toBe(entry.id);
      }
    }
  });

  it.each(businesses.filter(({ entry }) => Boolean(entry.shop)))('$map.id/$entry.id — a real purchase spends gold and grants stock', (business) => {
    const { entry } = business;
    const stock = chroniclesShopStock(entry);
    expect(stock.length, entry.id).toBeGreaterThan(0);
    const funded = chroniclesApplyContentEffects(atBusiness(business), [
      { type: 'grant-gold', amount: 5000 },
    ]);
    const item = stock.find((candidate) => candidate.price <= chroniclesGoldBalance(funded));
    expect(item, entry.id + ' must offer at least one purchasable item').toBeTruthy();
    const opened = chroniclesReduce(funded, 'interact');
    expect(opened.shop?.id).toBe(entry.id);
    const before = Number(opened.inventory?.[item.id]?.quantity || 0);
    const bought = chroniclesReduce(opened, { type: 'shop-buy', itemId: item.id });
    expect(bought.inventory?.[item.id]?.quantity).toBe(before + 1);
    expect(chroniclesGoldBalance(bought)).toBe(chroniclesGoldBalance(opened) - item.price);
  });
});
