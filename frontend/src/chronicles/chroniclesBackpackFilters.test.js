import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_BACKPACK_FILTERS,
  chroniclesBackpackCategory,
  chroniclesBackpackCounts,
  chroniclesBackpackMoveSelection,
  chroniclesFilterBackpack,
} from './chroniclesBackpackFilters.js';

const stock = Object.freeze([
  { id: 'bronze-sword', name: 'Espada de bronce', quantity: 1 },
  { id: 'wooden-bow', name: 'Arco corto de madera', quantity: 2 },
  { id: 'iron-chain', name: 'Cota de malla de hierro', quantity: 1 },
  { id: 'iron-shield', name: 'Escudo de hierro', quantity: 1 },
  { id: 'quest-seal', name: 'Sello del alguacil', description: 'Reliquia de misión', quantity: 1 },
]);

describe('Chronicles MM3 · explorador de mochila (#134)', () => {
  it('uses the catalog slots, never guesses from item names', () => {
    expect(CHRONICLES_BACKPACK_FILTERS.map(({ id }) => id))
      .toEqual(['all', 'weapon', 'missile', 'armor', 'shield', 'other']);
    expect(stock.map(chroniclesBackpackCategory))
      .toEqual(['weapon', 'missile', 'armor', 'shield', 'other']);
    expect(chroniclesBackpackCategory({ id: 'unknown' })).toBe('other');
    expect(chroniclesBackpackCounts(stock))
      .toEqual({ all: 5, weapon: 1, missile: 1, armor: 1, shield: 1, other: 1 });
  });

  it('filters only the intended slot, without dropping quest items or changing stock', () => {
    const original = JSON.stringify(stock);
    expect(chroniclesFilterBackpack(stock, 'missile').map((item) => item.id)).toEqual(['wooden-bow']);
    expect(chroniclesFilterBackpack(stock, 'other').map((item) => item.id)).toEqual(['quest-seal']);
    expect(chroniclesFilterBackpack(stock, 'weapon')).toEqual([stock[0]]);
    expect(chroniclesFilterBackpack(stock, 'all')).toEqual(stock);
    expect(chroniclesFilterBackpack(stock, 'not-a-slot')).toEqual(stock);
    expect(JSON.stringify(stock)).toBe(original);
    expect(stock[1].quantity).toBe(2);
  });

  it('searches accents, catalog descriptions, names and IDs case-insensitively', () => {
    expect(chroniclesFilterBackpack(stock, 'all', 'ESPADA').map((item) => item.id)).toEqual(['bronze-sword']);
    expect(chroniclesFilterBackpack(stock, 'other', 'reliquia').map((item) => item.id)).toEqual(['quest-seal']);
    expect(chroniclesFilterBackpack(stock, 'all', 'hierro').map((item) => item.id))
      .toEqual(['iron-chain', 'iron-shield']);
    expect(chroniclesFilterBackpack(stock, 'all', 'MALLA').map((item) => item.id))
      .toEqual(['iron-chain']);
    expect(chroniclesFilterBackpack(stock, 'missile', 'espada')).toEqual([]);
    expect(chroniclesFilterBackpack(stock, 'all', '   ')).toEqual(stock);
  });

  it('moves only the selected item through actual filtered stock without mutating it', () => {
    const filtered = chroniclesFilterBackpack(stock, 'all', 'hierro');
    const copy = JSON.stringify(stock);
    expect(chroniclesBackpackMoveSelection(filtered, filtered[0].id, 'ArrowDown'))
      .toBe(filtered[1].id);
    expect(chroniclesBackpackMoveSelection(filtered, filtered[1].id, 'ArrowDown'))
      .toBe(filtered[0].id);
    expect(chroniclesBackpackMoveSelection(filtered, filtered[0].id, 'ArrowUp'))
      .toBe(filtered[1].id);
    expect(chroniclesBackpackMoveSelection(filtered, filtered[0].id, 'End'))
      .toBe(filtered[1].id);
    expect(chroniclesBackpackMoveSelection(filtered, filtered[1].id, 'Home'))
      .toBe(filtered[0].id);
    expect(chroniclesBackpackMoveSelection([], null, 'ArrowDown')).toBeNull();
    expect(chroniclesBackpackMoveSelection(filtered, filtered[0].id, 's')).toBeNull();
    expect(JSON.stringify(stock)).toBe(copy);
  });

  it('handles an empty backpack without exceptions or synthetic objects', () => {
    expect(chroniclesBackpackCounts([]).all).toBe(0);
    expect(chroniclesFilterBackpack([], 'all', 'objeto')).toEqual([]);
    expect(chroniclesFilterBackpack(null, 'missile')).toEqual([]);
  });
});
