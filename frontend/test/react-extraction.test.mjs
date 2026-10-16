import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(path.join(root, p), 'utf8');

test('standalone React/Vite entry exists and mounts an actual React app', () => {
  const main = read('src/main.jsx');
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.dependencies.react, '18.3.1');
  assert.equal(manifest.dependencies['react-dom'], '18.3.1');
  assert.match(main, /createRoot\(root\)\.render/);
  assert.match(read('index.html'), /id="root"/);
  assert.match(read('vite.config.js'), /defineConfig/);
});

test('canonical Chess Studio React character-creator and assets are present', () => {
  const creator = read('src/components/ChroniclesCharacterSetup.jsx');
  assert.match(creator, /export default function ChroniclesCharacterSetup/);
  assert.match(creator, /confirmBuild\(/);
  assert.match(creator, /chroniclesRollCharacterStats/);
  assert.match(creator, /chroniclesMM3Derived/);
  assert.match(creator, /chronicles-character-setup__hero-grid/);
  assert.ok(read('src/components/ChroniclesCharacterSetup.css').length > 20000);
  const portraits = [
    'matthias-chronicles-canonical-v3.webp',
    'hildegard-canonical-v2.webp',
    'aziz-canonical-v2.webp',
    'faust-canonical-v2.webp',
  ];
  for (const image of portraits) assert.equal(existsSync(path.join(root, 'src/assets/chronicles', image)), true, image);
});

test('initial React integration is honest about gameplay and never requests live saves', () => {
  const app = read('src/App.jsx');
  assert.match(app, /<ChroniclesCharacterSetup/);
  assert.match(app, /createCanonicalChroniclesCharacterBuild/);
  assert.match(app, /explorationStep/);
  assert.match(app, /CRIPTA DE LAS OCHO CASILLAS/);
  assert.match(app, /no concede experiencia ni modifica guardados/);
  assert.doesNotMatch(app, /\bfetch\s*\(|\blocalStorage\b|\bXMLHttpRequest\b/i);
  // Explicit optional navigation to the old castle is not a dependency on its
  // auth, save APIs, frontend runtime or game engine.
  assert.match(app, /window\.location\.assign\('https:\/\/staging\.chess-studio\.shadowops\.dpdns\.org\/'\)/);
  assert.match(read('src/chroniclesOfMatthias.js'), /export function createChroniclesState/);
  assert.match(read('src/chroniclesOfMatthias.js'), /export function chroniclesReduce/);
  assert.doesNotMatch(read('src/chroniclesOfMatthias.js'), /Temporary compatibility boundary/);
});
