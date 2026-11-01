import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = (file) => readFileSync(
  new URL(`../frontend/src/components/${file}`, import.meta.url), 'utf8',
);

test('Estado, Equipo y Hechizos share the same MM3 desktop tab rail width', () => {
  const archive = component('ChroniclesCharacterSheetArchive.css');
  assert.match(archive, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+clamp\(152px,\s*11vw,\s*188px\)/);

  for (const file of [
    'ChroniclesCharacterRetroMM3.css',
    'ChroniclesCharacterEquipmentWorkspace.css',
    'ChroniclesCharacterGrimoireWorkspace.css',
  ]) {
    const css = component(file);
    // Chapter skins may stretch the rail, but not replace its shared column width.
    assert.doesNotMatch(
      css,
      /\.chronicles-character-sheet__folio-layout[^{}]*\{[^}]*grid-template-columns\s*:/s,
      `${file} must not override the shared tab rail width`,
    );
  }
});

test('all three MM3 desktop tab buttons retain equal-sized clickable targets', () => {
  const archive = component('ChroniclesCharacterSheetArchive.css');
  assert.match(archive, /\.chronicles-character-sheet__tabs button,\s*\.chronicles-character-sheet--mm3[^{}]*__tabs button\.is-active\s*\{[^}]*min-height:\s*56px;[^}]*height:\s*56px;[^}]*box-sizing:\s*border-box;/s);

  const jsx = component('ChroniclesCharacterSheet.jsx');
  for (const id of ['record', 'equipment', 'spells']) {
    assert.match(jsx, new RegExp(`id: '${id}'`));
  }
});
