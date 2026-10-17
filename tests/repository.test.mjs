import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('the repository is Chronicles and owns its source', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'chronicles-of-matthias');
  assert.equal(pkg.private, true);
  assert.match(read('docs/PROVENANCE.md'), /única fuente de verdad/);
});

test('game, API and their CI are present', () => {
  for (const path of [
    'frontend/package.json', 'frontend/src/components/ChroniclesOfMatthias.jsx',
    'frontend/src/standalone/App.jsx', 'api/cmd/chronicles-api/main.go', 'api/Dockerfile',
    '.github/workflows/react-frontend.yml', '.github/workflows/api.yml',
  ]) assert.ok(existsSync(new URL(path, root)), `missing ${path}`);
});

test('the game ships the runtime assets it loads from public/', () => {
  for (const path of ['frontend/public/audio/orchestra/violin-fs3.mp3', 'frontend/public/models/matthias-home-canonical.glb']) {
    assert.ok(existsSync(new URL(path, root)), `missing ${path}`);
  }
});
