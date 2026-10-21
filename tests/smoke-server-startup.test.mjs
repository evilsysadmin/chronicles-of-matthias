import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const helper = fileURLToPath(new URL('../frontend/smoke/wait-for-http.sh', import.meta.url));
const readWorkflow = (name) => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');

function probe(command, log = '/dev/null') {
  return spawnSync('bash', ['-c', 'source "$SMOKE_HELPER"; ' + command], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, SMOKE_HELPER: helper, SMOKE_LOG: log },
  });
}

test('all Chromium workflows bound Vite startup instead of polling indefinitely', () => {
  for (const name of ['react-frontend.yml', 'api.yml']) {
    const workflow = readWorkflow(name);
    assert.match(workflow, /source smoke\/wait-for-http\.sh/);
    assert.match(workflow, /wait_for_http http:\/\/localhost:4173\//);
    assert.doesNotMatch(workflow, /until curl -fs -o \/dev\/null/);
    assert.match(workflow, /trap 'kill /);
  }
  assert.match(readWorkflow('react-frontend.yml'), /wait_for_http http:\/\/localhost:4174\/smoke\/folio-mobile\.html/);
  const shell = readFileSync(helper, 'utf8');
  assert.match(shell, /for attempt in \{1\.\.40\}/);
  assert.match(shell, /--max-time 1/);
});

test('ready server returns immediately', () => {
  const result = probe('curl() { return 0; }; wait_for_http http://127.0.0.1:9 "$$" "$SMOKE_LOG" "ready"');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SMOKE_SERVER_READY/);
});

test('exited server fails and prints its Vite log', () => {
  const directory = mkdtempSync(join(tmpdir(), 'chronicles-smoke-'));
  try {
    const log = join(directory, 'vite.log');
    writeFileSync(log, 'EADDRINUSE: listen 4173\n');
    const result = probe('curl() { return 7; }; wait_for_http http://127.0.0.1:9 999999999 "$SMOKE_LOG" "exited"', log);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Chronicles smoke server exited/);
    assert.match(result.stdout, /EADDRINUSE/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('live but unresponsive server hits a finite startup deadline', () => {
  const result = probe('curl() { return 7; }; sleep() { :; }; wait_for_http http://127.0.0.1:9 "$$" "$SMOKE_LOG" "stuck"');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Chronicles smoke server timeout/);
});
