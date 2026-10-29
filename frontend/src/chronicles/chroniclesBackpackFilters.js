import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';

// These are UI groupings, never inventory migrations or class restrictions.
export const CHRONICLES_BACKPACK_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'Todos' }),
  Object.freeze({ id: 'weapon', label: 'Armas · A' }),
  Object.freeze({ id: 'missile', label: 'Proyectiles · S' }),
  Object.freeze({ id: 'armor', label: 'Armaduras' }),
  Object.freeze({ id: 'shield', label: 'Escudos' }),
  Object.freeze({ id: 'other', label: 'Otros' }),
]);

export function chroniclesBackpackCategory(item) {
  return CHRONICLES_EQUIPMENT[item?.id]?.slot || 'other';
}

// Roving selection in the MM3 backpack, pure and independent of stock updates.
export function chroniclesBackpackMoveSelection(items, selectedId, key) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)
    || !Array.isArray(items) || !items.length) return null;
  const selected = items.findIndex((item) => item.id === selectedId);
  if (key === 'Home') return items[0].id;
  if (key === 'End') return items[items.length - 1].id;
  // Without explicit selection, the first command should not skip the
  // previewed item. Keep row-key navigation unchanged for valid selected IDs.
  if (selected < 0) return key === 'ArrowDown' ? items[0].id : items[items.length - 1].id;
  const delta = key === 'ArrowDown' ? 1 : -1;
  return items[(selected + delta + items.length) % items.length].id;
}

export function chroniclesBackpackCounts(items) {
  const counts = Object.fromEntries(CHRONICLES_BACKPACK_FILTERS.map(({ id }) => [id, 0]));
  for (const item of Array.isArray(items) ? items : []) {
    counts.all += 1;
    counts[chroniclesBackpackCategory(item)] += 1;
  }
  return counts;
}

function searchable(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

// Selection/search never touch equipment or shared stock. Unknown inventory
// entries remain visible in "Otros" instead of silently disappearing.
export function chroniclesFilterBackpack(items, filter = 'all', query = '') {
  const list = Array.isArray(items) ? items : [];
  const category = CHRONICLES_BACKPACK_FILTERS.some(({ id }) => id === filter) ? filter : 'all';
  const term = searchable(query).trim();
  return list.filter((item) => {
    if (category !== 'all' && chroniclesBackpackCategory(item) !== category) return false;
    if (!term) return true;
    const catalog = CHRONICLES_EQUIPMENT[item?.id];
    return searchable([item?.name, item?.description, item?.id, catalog?.name, catalog?.description].join(' ')).includes(term);
  });
}
