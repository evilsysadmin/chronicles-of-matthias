import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('independent shell builds with its actual game modules', () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  const html = readFileSync('dist/index.html','utf8');
  const main = readFileSync('dist/src/main.js','utf8');
  assert.match(html, /src\/main.js/);
  assert.match(main, /chroniclesMM3Rules/);
});
