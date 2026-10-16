import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const originalBlob = path => {
  const bytes = readFileSync(new URL(path, import.meta.url));
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
};

test('original expedition Home and MM3 art are imported at exact source blob revisions', () => {
  assert.equal(originalBlob('../src/components/ChroniclesSaveMenu.css'),
    'f21b36cd83716f3d64643e35ccbfdcd8036b2289');
  assert.equal(originalBlob('../src/components/ChroniclesMM3Chrome.css'),
    '356d8cf51c4eb793cae567d50be297e4194796c3');
  for (const [asset, hash] of [
    ['expedition-study-approved.avif','4135f8965aed1ec24af8f40c1f0fd5943103ba98'],
    ['expedition-study-desktop-v2.avif','d02d93340f44eb92eb50068a608a66f6e695c8df'],
    ['ui/mm3-sapphire.png','5a841d1a8d0ab175c9f906309926da885c25c501'],
    ['ui/mm3-gem.png','cfcfae8c36b540a802b490ba40d4bfd555a6827b'],
    ['ui/mm3-frame.png','4a119c9320fcd503d7760ea0d2dbe3800ed68d54'],
    ['ui/mm3-stone.png','0834f65727d7a4571f0117c4edc9dbb881f4086b'],
  ]) {
    assert.equal(originalBlob('../src/assets/chronicles/' + asset),hash,asset);
  }
  assert.equal(existsSync(new URL('../src/assets/chronicles/ui/fonts/OFL-vt323.txt', import.meta.url)),true);
});

test('original Chronicles Home is mounted and shows only real actions', () => {
  const menu = read('../src/components/ChroniclesSaveMenu.jsx');
  const app = read('../src/App.jsx');
  assert.match(menu,/export default function ChroniclesSaveMenu/);
  assert.match(menu,/EL LIBRO DE LAS EXPEDICIONES/);
  assert.match(menu,/Nueva campaña/);
  assert.match(menu,/Continuar partida/);
  assert.match(menu,/Gestionar partidas/);
  assert.match(menu,/disabled=\{!resume \|\| loading\}/);
  assert.match(app,/import ChroniclesSaveMenu/);
  assert.match(app,/<ChroniclesSaveMenu/);
  assert.match(app,/saves=\{\[\]\}/);
  assert.match(app,/onNew=\{\(kind\) =>/);
  assert.match(app,/kind === 'swordhaven-first-book'/);
  assert.match(app,/Versión de migración · Sin combate ni guardados/);
  assert.match(menu,/standaloneSavedExpeditionArea\.js/);
});

test('the original sapphire and MM3 frame are applied to the REAL React HUD', () => {
  const css = read('../src/styles.css');
  const original = read('../src/components/ChroniclesMM3Chrome.css');
  const app = read('../src/App.jsx');
  assert.ok(css.startsWith("@import './components/ChroniclesMM3Chrome.css';"));
  assert.match(css,/\.react-town-topbar \.react-town-menu-button[\s\S]*?var\(--mm3-sapphire\)/);
  assert.match(css,/\.react-town-frame[\s\S]*?var\(--mm3-frame\)/);
  assert.match(css,/\.react-town-controls button[\s\S]*?var\(--mm3-stone\)/);
  assert.match(original,/\.chronicles-menu-gem__hint/);
  assert.match(app,/className="react-town-menu-button"/);
  assert.match(app,/<span>MENÚ<\/span>/);
  assert.doesNotMatch(app,/\bmaxHp\b|\bsetHp\b|\bgrantGold\b/);
});
