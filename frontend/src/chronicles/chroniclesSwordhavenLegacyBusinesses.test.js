import { describe, expect, it } from 'vitest';
import {
  chroniclesBuildingEntryState,
  chroniclesContextualContentAction,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesDoorwayPrompt } from './chroniclesDoorwayPrompt.js';
import { chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesInnRestPrice } from './chroniclesInns.js';
import { chroniclesShopStock } from './chroniclesShops.js';

const MAP_ID = 'swordhaven-square';
const businesses = [
  { id: 'swordhaven-forge', x: 4, y: 7, direction: 0, panel: 'shop' },
  { id: 'swordhaven-armor', x: 14, y: 7, direction: 0, panel: 'shop' },
  { id: 'swordhaven-tavern', x: 4, y: 11, direction: 2, panel: 'inn' },
  { id: 'swordhaven-magic', x: 14, y: 11, direction: 2, panel: 'shop' },
];
const at = ({ x, y, direction }) => ({
  ...createChroniclesState(MAP_ID, null, { rules: 'mm3' }),
  x, y, direction, phase: 'explore', initiative: null,
});

describe('Swordhaven legacy hub · every visible merchant door works', () => {
  const map = chroniclesMapById(MAP_ID);

  it('preserves stable interactable IDs and aligns south-side doors to their rendered north facades', () => {
    expect(map.interactables.map((entry) => entry.id)).toEqual([
      'swordhaven-forge', 'swordhaven-armor', 'swordhaven-tavern',
      'swordhaven-magic', 'swordhaven-temple',
    ]);
    expect(map.interactables.find((entry) => entry.id === 'swordhaven-temple')).toMatchObject({
      x: 9, y: 5,
    });
    expect(map.interactables.find((entry) => entry.id === 'swordhaven-tavern')).toMatchObject({
      x: 4, y: 11, visualType: 'building-tavern',
    });
    expect(map.interactables.find((entry) => entry.id === 'swordhaven-magic')).toMatchObject({
      x: 14, y: 11, visualType: 'building-apothecary',
    });
    for (const business of businesses) {
      const entry = map.interactables.find((candidate) => candidate.id === business.id);
      expect(map.grid[entry.y][entry.x], business.id).toBe('.');
      const current = at(business);
      // Walking into precisely the door drawn by the shared settlement layout.
      expect(chroniclesBuildingEntryState(current)).toMatchObject({ x: entry.x, y: entry.y });
    }
  });

  it.each(businesses)('$id: F/USAR and walking into its actual door enter the $panel', (business) => {
    const current = at(business);
    const raw = chroniclesContextualContentAction(current);
    expect(raw?.id).toBe(business.id);
    expect(chroniclesDoorwayPrompt(current, raw, null).contextual?.id).toBe(business.id);
    expect(chroniclesReduce(current, 'interact')[business.panel]?.id).toBe(business.id);
    expect(chroniclesReduce(current, 'forward')[business.panel]?.id).toBe(business.id);

    const away = { ...current, direction: (business.direction + 2) % 4 };
    expect(chroniclesDoorwayPrompt(away, chroniclesContextualContentAction(away), null).contextual?.id)
      .not.toBe(business.id);
  });

  it('no longer advertises either southern entrance from its obsolete back-street coordinate', () => {
    for (const [x, id] of [[4, 'swordhaven-tavern'], [14, 'swordhaven-magic']]) {
      const behind = at({ x, y: 15, direction: 0 });
      expect(chroniclesDoorwayPrompt(behind, chroniclesContextualContentAction(behind), null)
        .contextual?.id).not.toBe(id);
      expect(chroniclesReduce(behind, 'interact').shop?.id).not.toBe(id);
      expect(chroniclesReduce(behind, 'interact').inn?.id).not.toBe(id);
    }
  });

  it('uses existing item rules for real purchases instead of a placeholder message', () => {
    for (const business of businesses.filter((candidate) => candidate.panel === 'shop')) {
      const entry = map.interactables.find((candidate) => candidate.id === business.id);
      const stock = chroniclesShopStock(entry);
      expect(stock.length, entry.id).toBeGreaterThan(0);
      const current = at(business);
      const selected = stock.find((item) => item.price <= chroniclesGoldBalance(current));
      expect(selected, entry.id).toBeTruthy();
      const opened = chroniclesReduce(current, 'interact');
      const quantity = Number(opened.inventory?.[selected.id]?.quantity || 0);
      const bought = chroniclesReduce(opened, { type: 'shop-buy', itemId: selected.id });
      expect(bought.shop?.id).toBe(business.id);
      expect(bought.inventory?.[selected.id]?.quantity).toBe(quantity + 1);
      expect(chroniclesGoldBalance(bought)).toBe(chroniclesGoldBalance(opened) - selected.price);
    }
  });

  it('enters the real inn for free and charges only on a separate REST action', () => {
    const current = at(businesses[2]);
    const inn = map.interactables.find((entry) => entry.id === 'swordhaven-tavern');
    expect(chroniclesInnRestPrice(inn)).toBe(5);
    const wounded = {
      ...current,
      party: current.party.map((member) => ({ ...member, hp: Math.max(1, member.hp - 1) })),
    };
    const opened = chroniclesReduce(wounded, 'interact');
    expect(opened.inn?.id).toBe(inn.id);
    expect(chroniclesGoldBalance(opened)).toBe(chroniclesGoldBalance(wounded));
    const rested = chroniclesReduce(opened, { type: 'inn-rest' });
    expect(chroniclesGoldBalance(rested)).toBe(chroniclesGoldBalance(opened) - 5);
    expect(rested.party.every((member) => member.hp === member.maxHp)).toBe(true);
  });
});
