import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sheet = readFileSync(new URL('../frontend/src/components/ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
const skin = readFileSync(new URL('../frontend/src/components/ChroniclesCharacterInventoryRetro.css', import.meta.url), 'utf8');

test('MM3 inventory distinguishes preview from an explicitly selected transfer target', () => {
  assert.match(sheet, /transferableItem \|\| \(!tacticsMode \? visibleBackpack\[0\] : null\)/);
  assert.match(sheet, /transferableItem \? 'Seleccionado · se puede entregar' : 'Vista previa · selecciónalo para entregarlo'/);
  assert.match(sheet, /onEquipmentAction\?\.\(\{ type: 'transfer-item', itemId: transferableItem\.id, toMemberId: targetId \}\)/);
});

test('equipment unequip controls are concise but identify the affected item for assistive tech', () => {
  const labels = sheet.match(/aria-label=\{`Quitar \$\{worn\.name\} y guardarlo en la mochila`\}/g) || [];
  assert.equal(labels.length, 2, 'both weapon and armor/shield actions have item-specific labels');
  assert.equal((sheet.match(/type: 'unequip-item', slot/g) || []).length, 2);
  assert.equal((sheet.match(/>\s*Guardar en mochila\s*</g) || []).length, 0);
});

test('equipment panel is one full-width reading flow with reserved party dock', () => {
  assert.match(skin, /\[data-chronicles-equipment-folio\] \.chronicles-character-sheet__loadout\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(skin, /\.chronicles-character-sheet__party-dock\s*\{[^}]*min-height: 78px/s);
  assert.match(skin, /\.chronicles-character-sheet__head\s*\{\s*padding-left: 28px/s);
  assert.match(skin, /@media \(max-width: 850px\), \(max-height: 580px\)/);
});
