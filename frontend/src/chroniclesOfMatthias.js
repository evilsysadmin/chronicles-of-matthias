// Temporary compatibility boundary for the ORIGINAL React character creator.
// Canonical party definition copied from chess-studio@89c482369f942adb0a241004f674f8ed5bb5e12d,
// frontend/src/chroniclesOfMatthias.js. The full game reducer is not migrated yet.
// Replace this file with the actual reducer and its imports during runtime extraction.
export const CHRONICLES_PARTY = Object.freeze([
  Object.freeze({ id: 'matthias', name: 'Matthias', role: 'Peón cronista', glyph: '♟', maxHp: 7, agility: 4, row: 'front', lane: 'left', attackName: 'Estocada', damage: 1, reach: 1 }),
  Object.freeze({ id: 'rook', name: 'Hildegard', role: 'Torre guardiana', glyph: '♜', maxHp: 10, agility: 2, row: 'front', lane: 'right', attackName: 'Embestida', damage: 2, reach: 1 }),
  Object.freeze({ id: 'bishop', name: 'Aziz', role: 'Alfil del farol', glyph: '♝', maxHp: 6, agility: 3, row: 'back', lane: 'left', attackName: 'Rayo diagonal', damage: 1, reach: 2 }),
  Object.freeze({ id: 'knight', name: 'Faust', role: 'Caballo logístico', glyph: '♞', maxHp: 8, agility: 5, row: 'back', lane: 'right', attackName: 'Salto brutal', damage: 1, reach: 2 }),
]);
