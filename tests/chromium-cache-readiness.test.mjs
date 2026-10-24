import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import test from 'node:test';

const script = new URL('../frontend/smoke/ensure-chromium.sh', import.meta.url).pathname;

function runProbe(firstStatus) {
  const dir = mkdtempSync(join(tmpdir(), 'chronicles-browser-ci-'));
  try {
    const npx = join(dir, 'npx');
    const node = join(dir, 'node');
    const calls = join(dir, 'calls');
    writeFileSync(npx, '#!/bin/sh\nprintf "npx %s\\n" "$*" >> "$FAKE_CALLS"\n');
    writeFileSync(node, `#!/bin/sh
printf "node %s\\n" "$*" >> "$FAKE_CALLS"
if [ ! -e "$FAKE_PROBE_ONCE" ]; then
  touch "$FAKE_PROBE_ONCE"
  exit "$FAKE_FIRST_STATUS"
fi
exit 0
`);
    chmodSync(npx, 0o755);
    chmodSync(node, 0o755);
    const run = spawnSync('bash', [script], {
      cwd: new URL('../frontend/', import.meta.url).pathname,
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        FAKE_CALLS: calls,
        FAKE_PROBE_ONCE: join(dir, 'first-probe'),
        FAKE_FIRST_STATUS: String(firstStatus),
      },
    });
    return { status: run.status, output: readFileSync(calls, 'utf8').trim().split('\n'), stderr: run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('already working cached Chromium never invokes apt installation', () => {
  const result = runProbe(0);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, ['npx playwright install chromium', 'node smoke/chromium-host-probe.mjs']);
});

test('missing Chromium host libraries trigger official dependency install and a fresh probe', () => {
  const result = runProbe(42);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, [
    'npx playwright install chromium',
    'node smoke/chromium-host-probe.mjs',
    'npx playwright install-deps chromium',
    'node smoke/chromium-host-probe.mjs',
  ]);
});

test('other browser errors fail closed instead of mutating the runner with apt', () => {
  const result = runProbe(11);
  assert.equal(result.status, 11, result.stderr);
  assert.deepEqual(result.output, ['npx playwright install chromium', 'node smoke/chromium-host-probe.mjs']);
});
