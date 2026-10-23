import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mount = readFileSync(new URL('../frontend/smoke/mount.mjs', import.meta.url), 'utf8');
const book = readFileSync(new URL('../frontend/src/components/ChroniclesSaveMenu.jsx', import.meta.url), 'utf8');
const component = readFileSync(new URL('../frontend/src/components/ChroniclesOfMatthias.jsx', import.meta.url), 'utf8');

test('Chronicles fixture gates on the real save menu, not a network silence heuristic', () => {
  assert.match(mount, /if \(label === 'Chronicles'\) \{/);
  assert.match(mount, /page\.goto\(base \+ hash, \{ waitUntil: 'load' \}\)/);
  assert.match(mount, /page\.locator\('\[data-chronicles-save-menu\]'\)/);
  assert.match(mount, /book\.waitFor\(\{ state: 'visible', timeout: 20_000 \}\)/);
  assert.match(mount, /menu\.querySelector\('\[data-chronicles-primary-action\]'\)/);
  assert.match(mount, /menu\.querySelector\('\.chronicles-save-menu__sync\[role="status"\]'\)/);
  assert.match(mount, /document\.fonts\.status === 'loaded'/);
  assert.match(mount, /image\.complete && image\.naturalWidth > 0/);
  assert.match(book, /data-chronicles-save-menu=\{screen\}/);
  assert.match(book, /data-chronicles-primary-action=\{resume \? 'continue' : 'new'\}/);
  assert.match(book, /className="chronicles-save-menu__sync" role="status"/);
  assert.match(component, /if \(entryView === 'menu'\)/);
});

test('Tactics keeps its proven network-idle navigation and both modes keep late error coverage', () => {
  assert.match(mount, /\} else \{\s*\/\/ Tactics was already ready/);
  assert.match(mount, /page\.goto\(base \+ hash, \{ waitUntil: 'networkidle' \}\)/);
  assert.match(mount, /await page\.waitForTimeout\(6000\)/);
  assert.match(mount, /phaseDone\(label, 'late-errors', lateErrorsStarted\)/);
  assert.match(mount, /errors\.length === 0 && rootLength > 500/);
  assert.match(mount, /smoke-\$\{slug\}\.png/);
  assert.match(mount, /process\.exit\(failed \? 1 : 0\)/);
});

test('mount still tests cold first paint, released update action and keyboard travel', () => {
  assert.match(mount, /First-paint loader fails viewport contract/);
  assert.match(mount, /Nueva versión disponible/);
  assert.match(mount, /Travel confirmation buttons are not keyboard reachable/);
});
