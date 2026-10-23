import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../frontend/smoke/shop-room.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/react-frontend.yml', import.meta.url), 'utf8');

test('shop smoke covers the same 8 Brunna widths, Odo/guild and apothecary scenes', () => {
  assert.match(source, /\[\[360, 780\], \[390, 844\], \[430, 932\], \[844, 390\], \[1280, 800\], \[1440, 900\], \[1740, 864\], \[1909, 900\]\]/);
  assert.match(source, /for \(const room of \['odo', 'guild'\]\)/);
  assert.match(source, /for \(const \[width, height\] of \[\[390, 844\], \[1280, 800\]\]\)/);
  assert.match(workflow, /node smoke\/run-timed\.mjs smoke\/shop-room\.mjs /);
  assert.match(source, /smoke-shop-\$\{width\}\.png/);
  assert.match(source, /smoke-shop-\$\{room\}-\$\{width\}\.png/);
});

test('every shop navigation uses actual dialog/fonts/visible-artwork readiness', () => {
  assert.match(source, /async function gotoReadyShop\(page, target\)/);
  assert.match(source, /page\.goto\(target, \{ waitUntil: 'load' \}\)/);
  assert.match(source, /page\.getByRole\('dialog'\)\.waitFor\(\{ state: 'visible', timeout: 20_000 \}\)/);
  assert.match(source, /document\.fonts\.status === 'loaded'/);
  assert.match(source, /img\.complete && img\.naturalWidth > 0/);
  assert.doesNotMatch(source, /waitUntil: 'networkidle'|page\.waitForTimeout\(/);
  assert.equal((source.match(/await gotoReadyShop\(page,/g) || []).length, 4);
});

test('transaction, wallet-limit, visual and failure assertions remain mandatory', () => {
  assert.match(source, /shop-sell:brass-dagger/);
  assert.match(source, /Gold cap must block unpayable sale/);
  assert.match(source, /art\.loaded, room \+ ': artwork did not decode/);
  assert.match(source, /'Apothecary must keep all three authored offers'/);
  assert.match(source, /assert\.deepEqual\(errors, \[\]/);
  assert.match(source, /if \(failed\) process\.exitCode = 1/);
});
