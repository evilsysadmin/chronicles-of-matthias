import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const runner = fileURLToPath(new URL('../frontend/smoke/run-timed.mjs', import.meta.url));
const workflow = readFileSync(new URL('../.github/workflows/react-frontend.yml', import.meta.url), 'utf8');

test('all 16 real Chromium fixtures stay sequential and measured', () => {
  const scripts = [...workflow.matchAll(/^          node smoke\/run-timed\.mjs smoke\/([a-z0-9-]+\.mjs) http:\/\/localhost:\d+\//gm)]
    .map((x) => x[1]);
  assert.equal(scripts.length, 16, 'a missing smoke fixture must not silently shorten CI');
  assert.equal(new Set(scripts).size, 16);
  for (const expected of [
    'mount.mjs', 'character-sheet-desktop.mjs', 'spell-target-banner.mjs',
    'folio-mobile.mjs', 'shop-room.mjs', 'audience-room.mjs', 'interior-art-gate.mjs', 'inn-room.mjs', 'journal-book.mjs',
    'loader.mjs', 'character-setup.mjs', 'save-menu.mjs', 'first-hour-contact.mjs',
    'adventure-menu-shortcuts.mjs', 'area-transition-choice.mjs',
    'swordhaven-streets.mjs',
  ]) {
    assert.ok(scripts.includes(expected), expected);
  }
  assert.doesNotMatch(workflow, /^          node smoke\/(?!run-timed\.mjs)/m);
});

test('timing wrapper retains real exit codes, passed args and a single summary header', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'chronicles-smoke-timings-'));
  try {
    const success = join(tmp, 'passing.mjs');
    const failing = join(tmp, 'failing.mjs');
    const summary = join(tmp, 'summary.md');
    writeFileSync(success, 'if (process.argv[2] !== "EXPECTED") process.exit(4); console.log("REAL_FIXTURE_PASSED");\n');
    writeFileSync(failing, 'console.error("REAL_FIXTURE_FAILED"); process.exit(17);\n');

    const run = (target, ...args) => spawnSync(process.execPath, [runner, target, ...args], {
      env: { ...process.env, GITHUB_STEP_SUMMARY: summary },
      encoding: 'utf8',
      timeout: 10_000,
    });
    const ok = run(success, 'EXPECTED');
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /REAL_FIXTURE_PASSED/);
    assert.match(ok.stdout, /CHRONICLES_SMOKE_TIME fixture=passing\.mjs seconds=[0-9.]+ status=PASS/);

    const bad = run(failing);
    assert.equal(bad.status, 17, bad.stderr);
    assert.match(bad.stderr, /REAL_FIXTURE_FAILED/);
    assert.match(bad.stderr, /Chronicles Chromium smoke failed/);
    assert.match(bad.stdout, /CHRONICLES_SMOKE_TIME fixture=failing\.mjs seconds=[0-9.]+ status=FAIL/);

    const report = readFileSync(summary, 'utf8');
    assert.equal(report.match(/## Chronicles Chromium smoke timings/g)?.length, 1);
    assert.match(report, /\| passing\.mjs \| [0-9.]+ \| PASS \|/);
    assert.match(report, /\| failing\.mjs \| [0-9.]+ \| FAIL \|/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('wrapper rejects invalid or missing fixture entrypoints without false success', () => {
  for (const args of [[], ['not-a-module'], ['missing.mjs']]) {
    const run = spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', timeout: 10_000 });
    assert.notEqual(run.status, 0);
    assert.doesNotMatch(run.stdout, /status=PASS/);
  }
});
