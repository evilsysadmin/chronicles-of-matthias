import { describe, expect, it } from 'vitest';
import { chroniclesShopCategories, chroniclesShopSelectedOffer, chroniclesShopVisibleOffers } from './chroniclesShopCatalog.js';

const offers = [
  { item: { id: 'oak', slot: 'weapon', name: 'Bastón de madera', description: 'Bastón a dos manos' }, price: 1 },
  { item: { id: 'iron', slot: 'weapon', name: 'Espada de hierro', description: 'Corte' }, price: 7 },
  { item: { id: 'potion', slot: 'consumable', name: 'Poción de vida', description: 'Recupera salud' }, price: 4 },
  { item: { id: 'quest', slot: 'custom', name: 'Sello raro', description: 'Objetos desconocidos' }, price: 2 },
];

describe('Chronicles shop catalog view', () => {
  it('sorts by name or price without mutating authoritative stock', () => {
    expect(chroniclesShopVisibleOffers(offers).map((offer) => offer.item.id)).toEqual(['oak', 'iron', 'potion', 'quest']);
    expect(chroniclesShopVisibleOffers(offers, { sort: 'price-asc' }).map((offer) => offer.item.id))
      .toEqual(['oak', 'quest', 'potion', 'iron']);
    expect(chroniclesShopVisibleOffers(offers, { sort: 'price-desc' })[0].item.id).toBe('iron');
    expect(offers[0].item.id).toBe('oak');
  });
  it('filters by type and name/description but never deletes unusual items', () => {
    expect(chroniclesShopVisibleOffers(offers, { category: 'weapon', query: 'hierro' }).map((offer) => offer.item.id))
      .toEqual(['iron']);
    expect(chroniclesShopVisibleOffers(offers, { category: 'other' }).map((offer) => offer.item.id)).toEqual(['quest']);
    expect(chroniclesShopCategories(offers).map((entry) => entry.value)).toEqual(['weapon', 'consumable', 'other']);
    expect(chroniclesShopVisibleOffers(offers, { query: '  VIDA ' })[0].item.id).toBe('potion');
  });
  it('keeps missile weapons separate from potions and melee swords', () => {
    const missile = { item: { id: 'longbow', slot: 'missile', name: 'Arco largo', description: 'Alcance 4' }, price: 3 };
    const stock = [...offers, missile];
    expect(chroniclesShopCategories(stock)).toContainEqual({ value: 'missile', label: 'Armas a distancia' });
    expect(chroniclesShopVisibleOffers(stock, { category: 'missile' })).toEqual([missile]);
    expect(chroniclesShopVisibleOffers(stock, { category: 'consumable' }).map((offer) => offer.item.id))
      .toEqual(['potion']);
  });

  it('falls back to a visible offer when selected item has been sold or filtered away', () => {
    expect(chroniclesShopSelectedOffer(offers, 'iron')?.item.id).toBe('iron');
    expect(chroniclesShopSelectedOffer(offers.slice(0, 1), 'iron')?.item.id).toBe('oak');
    expect(chroniclesShopSelectedOffer([], 'iron')).toBe(null);
  });
});
