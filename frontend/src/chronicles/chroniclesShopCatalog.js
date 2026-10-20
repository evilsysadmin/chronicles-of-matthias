// Presentation only: never change stock, inventory, gold, or shop transaction rules.
// Unknown item slots are retained under "Otros" rather than silently discarded.
export const SHOP_SLOT_LABELS = Object.freeze({
  weapon: 'Armas',
  missile: 'Armas a distancia',
  armor: 'Armaduras',
  shield: 'Escudos',
  consumable: 'Objetos',
});

export const SHOP_SORTS = Object.freeze([
  { value: 'name', label: 'Nombre A–Z' },
  { value: 'price-asc', label: 'Precio: menor primero' },
  { value: 'price-desc', label: 'Precio: mayor primero' },
  { value: 'type', label: 'Tipo de objeto' },
]);

const nameOrder = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function chroniclesShopCategories(items = []) {
  return Object.keys(SHOP_SLOT_LABELS)
    .filter((slot) => items.some(({ item }) => item.slot === slot))
    .map((slot) => ({ value: slot, label: SHOP_SLOT_LABELS[slot] }))
    .concat(items.some(({ item }) => !(item.slot in SHOP_SLOT_LABELS))
      ? [{ value: 'other', label: 'Otros' }] : []);
}

export function chroniclesShopVisibleOffers(offers, { category = 'all', query = '', sort = 'name' } = {}) {
  const text = String(query).trim().toLocaleLowerCase('es');
  return offers
    .filter(({ item }) => (
      (category === 'all' || (category === 'other'
        ? !(item.slot in SHOP_SLOT_LABELS) : item.slot === category))
      && (!text || (item.name + ' ' + (item.description || '')).toLocaleLowerCase('es').includes(text))
    ))
    .slice()
    .sort((a, b) => {
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      if (sort === 'price-asc') return priceA - priceB || nameOrder.compare(a.item.name, b.item.name);
      if (sort === 'price-desc') return priceB - priceA || nameOrder.compare(a.item.name, b.item.name);
      if (sort === 'type') return nameOrder.compare(a.item.slot, b.item.slot) || nameOrder.compare(a.item.name, b.item.name);
      return nameOrder.compare(a.item.name, b.item.name);
    });
}

export function chroniclesShopSelectedOffer(offers, selectedId) {
  return offers.find(({ item }) => item.id === selectedId) || offers[0] || null;
}
