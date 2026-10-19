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
