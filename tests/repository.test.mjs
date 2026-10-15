import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('repository declares independent identity', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'chronicles-of-matthias');
  assert.equal(pkg.private, true);
});

test('migration explicitly protects player saves', () => {
  assert.match(read('README.md'), /save/i);
  assert.match(read('docs/extraction-audit.md'), /localStorage/);
});
