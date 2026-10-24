import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../frontend/smoke/mount.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/react-frontend.yml', import.meta.url), 'utf8');

test('both real authenticated game modes keep their full six-second late-error observations', () => {
  assert.match(source, /for \(const \[label, hash\] of \[\['Chronicles', ''\], \['Tactics', '#tactics'\]\]\)/);
  assert.match(source, /await page\.goto\(base \+ hash, \{ waitUntil: 'networkidle' \}\)/);
  assert.match(source, /await page\.waitForTimeout\(6000\)/);
  assert.match(source, /page\.on\('pageerror', \(e\) => errors\.push\(e\.message\)\)/);
  assert.match(source, /const ok = errors\.length === 0 && rootLength > 500/);
  assert.match(source, /if \(!ok\) failed = true/);
  assert.match(source, /process\.exit\(failed \? 1 : 0\)/);
});

test('per-phase diagnostics include navigation, observation, assertions, screenshot and total', () => {
  const phases = ['navigation', 'late-errors', 'assertions', 'screenshot', 'total'];
  for (const phase of phases) {
    assert.ok(source.includes("phaseDone(label, '" + phase + "'"), phase);
  }
  assert.match(source, /performance\.now\(\)/);
  assert.match(source, /CHRONICLES_MOUNT_PHASE label=/);
  assert.match(source, /seconds=\$\{seconds\}/);
  assert.match(workflow, /node smoke\/run-timed\.mjs smoke\/mount\.mjs http:\/\/localhost:4173\//);
  assert.match(source, /smoke-\$\{slug\}\.png/);
});

test('original loader screenshots, release prompt and travel UX remain covered', () => {
  assert.match(source, /smoke-loader-/);
  assert.match(source, /Nueva versión disponible/);
  assert.match(source, /smoke-travel-confirm-/);
  assert.match(source, /Travel confirmation obscures viewport/);
});
