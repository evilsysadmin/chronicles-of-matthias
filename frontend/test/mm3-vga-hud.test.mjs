import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const asset = name => new URL('../src/assets/chronicles/ui/' + name, import.meta.url);
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
function gitBlob(file) {
  const data = readFileSync(asset(file));
  return createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
}

test('MM3 assets are byte-for-byte originals with the original font license', () => {
  // Original chess-studio main@55e95f75d5c417e95dbe39f87c9e2732bf3736fa
  for (const [path, hash] of [
    ['mm3-frame.png', '4a119c9320fcd503d7760ea0d2dbe3800ed68d54'],
    ['mm3-gem.png', 'cfcfae8c36b540a802b490ba40d4bfd555a6827b'],
    ['mm3-sandstone.png', '7f53f377d4d8f64c289064bd513a0c2b73345137'],
    ['mm3-sapphire.png', '5a841d1a8d0ab175c9f906309926da885c25c501'],
    ['mm3-stone.png', '0834f65727d7a4571f0117c4edc9dbb881f4086b'],
    ['fonts/vt323-latin-400-normal.woff2', 'fd760b5bad0f5b31d4b47b8e3bf333b16f4a69eb'],
  ]) assert.equal(gitBlob(path), hash, path);
  assert.match(read('../src/assets/chronicles/ui/fonts/OFL-vt323.txt'), /SIL OPEN FONT LICENSE/i);
});

test('authentic original VGA source assets style the active React HUD, not a mock page', () => {
  const css = read('../src/chronicles/MM3VgaHud.css');
  const entry = read('../src/main.jsx');
  for (const name of ['mm3-frame.png','mm3-gem.png','mm3-sandstone.png','mm3-sapphire.png','mm3-stone.png','vt323-latin-400-normal.woff2']) {
    assert.ok(css.includes(name), name);
  }
  for (const selector of [
    '.react-town-frame', '.react-town-hud::after', '.react-town-objective',
    '.react-town-party-member', '.react-town-controls button',
    '.react-town-map-panel', '.react-town-menu-button', '.react-town-journal',
  ]) assert.ok(css.includes(selector), selector);
  assert.match(entry, /import '\.\/styles.css';\s*import '\.\/chronicles\/MM3VgaHud.css';/);
  assert.match(css, /color-scheme: only light/); // Brave forced dark
  assert.match(css, /image-rendering:pixelated/);
  assert.doesNotMatch(css, /url\(https?:|fake|mock-health|fake-hp/i);
});

test('real gameplay and Three.js untouched: no fake attack or HP statistics added', () => {
  const app = read('../src/App.jsx');
  const source = read('../src/chronicles/MM3VgaHud.css');
  assert.match(app, /<SwordhavenViewport state=\{town\}/);
  assert.match(app, /<SwordhavenMiniMap state=\{town\}/);
  assert.doesNotMatch(app.slice(app.indexOf("if (page === 'town')"), app.indexOf('  return (\n    <main className="chronicles-react">')),
    /\battackWithSelected\b|\bexperience\b/);
  assert.doesNotMatch(source, /@keyframes.*attack/i);
});
