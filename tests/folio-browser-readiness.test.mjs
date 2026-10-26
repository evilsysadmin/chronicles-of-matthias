import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../frontend/smoke/folio-mobile.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/react-frontend.yml', import.meta.url), 'utf8');

test('mobile folio still covers all 29 real view/viewport pairs', () => {
  assert.match(source, /\[\[360, 780\], \[390, 844\], \[430, 932\], \[844, 390\], \[1280, 800\]\]/);
  assert.match(source, /width === 1280 \? \['cast', 'adventure', 'healing', 'revive', 'rescue'\]/);
  assert.match(source, /\['cast', 'items', 'adventure', 'healing', 'revive', 'rescue'\]/);
  assert.match(workflow, /node smoke\/run-timed\.mjs smoke\/folio-mobile\.mjs /);
});

test('folio navigations wait for actual presentation, not a blind network-idle timer', () => {
  assert.match(source, /page\.goto\(base \+ '\?view=' \+ view, \{ waitUntil: 'load' \}\)/);
  assert.match(source, /dialog\.waitFor\(\{ state: 'visible', timeout: 20_000 \}\)/);
  assert.match(source, /page\.waitForFunction\(\(\) => \{/);
  assert.match(source, /document\.fonts\.status === 'loaded'/);
  assert.match(source, /img\.complete && img\.naturalWidth > 0/);
  assert.doesNotMatch(source, /waitUntil: 'networkidle'|page\.waitForTimeout\(/);
});

test('screen captures and interaction assertions stay mandatory', () => {
  assert.match(source, /await page\.screenshot\(\{ path: `smoke-folio-\$\{view\}-\$\{width\}\.png` \}\)/);
  assert.match(source, /assert\.deepEqual\(errors, \[\]/);
  assert.match(source, /undersized = buttons\.filter/);
  assert.match(source, /assert\.equal\(await fallen\.isDisabled\(\), true/);
  assert.match(source, /assert\.equal\(await fallen\.isEnabled\(\), true/);
  assert.match(source, /if \(failures\) process\.exitCode = 1/);
});
