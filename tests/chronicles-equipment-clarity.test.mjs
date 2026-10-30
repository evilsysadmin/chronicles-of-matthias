import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sheet = readFileSync(new URL('../frontend/src/components/ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
const skin = readFileSync(new URL('../frontend/src/components/ChroniclesCharacterInventoryRetro.css', import.meta.url), 'utf8');

test('MM3 inventory distinguishes preview from an explicitly selected transfer target', () => {
  assert.match(sheet, /transferableItem \|\| \(!tacticsMode \? visibleBackpack\[0\] : null\)/);
  assert.match(sheet, /transferableItem \? 'Seleccionado · se puede entregar' : 'Vista previa · selecciónalo para entregarlo'/);
  assert.match(sheet, /type: 'transfer-item'/);
  assert.match(sheet, /type: 'transfer-equipped-item'/);
  assert.match(sheet, /transferSelection = selectedWornItem/);
});

test('party slots transfer an explicitly selected item; otherwise they navigate', () => {
  const dock = sheet.split('<nav className="chronicles-character-sheet__party-dock"')[1];
  assert.ok(dock, 'Four real portraits remain in the visible dock');
  assert.match(sheet, /const directTransferMode = !tacticsMode && activeFolio === 'equipment'/);
  assert.match(sheet, /Boolean\(transferSelection\) && canChangeEquipment/);
  assert.match(sheet, /chroniclesPartyHotkeyMember\(event, state\.party\)/);
  assert.match(sheet, /if \(directTransferMode\) \{/);
  assert.match(sheet, /if \(hero\.id !== member\.id\) giveSelectedItemTo\(hero\.id\)/);
  assert.match(sheet, /viewMember\(hero\.id\)/);
  assert.match(dock, /data-transfer-target=/);
  assert.match(dock, /if \(directTransferMode && hero\.id !== member\.id\) giveSelectedItemTo\(hero\.id\)/);
  assert.match(dock, /else viewMember\(hero\.id\)/);
  assert.match(sheet, /if \(!transferSelection \|\| !canChangeEquipment \|\| targetId === member\.id\) return;/);
  assert.match(sheet, /if \(transferSelection\.slot\)/);
  assert.match(sheet, /slot: transferSelection\.slot, toMemberId: targetId/);
  assert.match(sheet, /setSelectedBagItem\(selectedItemId === item\.id/);
  assert.doesNotMatch(sheet, /showRecipients|classic-recipients|recipientsRef/);
  // Actual keyboard, mouse and combat behavior is covered by Chromium smoke.
});

test('equipment unequip controls are concise but identify the affected item for assistive tech', () => {
  const labels = sheet.match(/aria-label=\{`Quitar \$\{worn\.name\} y guardarlo en la mochila`\}/g) || [];
  assert.equal(labels.length, 2, 'both weapon and armor/shield actions have item-specific labels');
  assert.equal((sheet.match(/type: 'unequip-item', slot/g) || []).length, 3,
    'two advanced per-slot controls plus the one contextual Quitar action');
  assert.match(sheet, /type: 'unequip-item', slot: selectedWornItem\.slot/);
  assert.equal((sheet.match(/>\s*Guardar en mochila\s*</g) || []).length, 0);
});

test('equipment panel is one full-width reading flow with reserved party dock', () => {
  assert.match(skin, /\[data-chronicles-equipment-folio\] \.chronicles-character-sheet__loadout\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(skin, /\.chronicles-character-sheet__party-dock\s*\{[^}]*min-height: 64px/s);
  assert.match(skin, /\.chronicles-character-sheet__head\s*\{\s*padding-left: 28px/s);
  assert.match(skin, /@media \(max-width: 850px\), \(max-height: 580px\)/);
});