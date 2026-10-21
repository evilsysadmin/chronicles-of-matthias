import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  new URL('../.github/workflows/signal-shadowops-infra.yml', import.meta.url),
  'utf8',
);
const title = '      - name: Require current protected source main with three green workflows';
const begin = source.indexOf('        run: |\n', source.indexOf(title)) + '        run: |\n'.length;
const end = source.indexOf('\n  dispatch:\n', begin);
assert.ok(begin > 0 && end > begin);
const script = source.slice(begin, end).split('\n').map((line) =>
  line.startsWith('          ') ? line.slice(10) : line,
).join('\n');

const sha = 'a'.repeat(40);
const ids = [385763056, 386812503, 387132683];
const greenRuns = () => ids.map((workflow_id, index) => ({
  id: 100 + index,
  workflow_id,
  head_sha: sha,
  event: 'push',
  head_branch: 'main',
  repository: { full_name: 'evilsysadmin/chronicles-of-matthias' },
  status: 'completed',
  conclusion: 'success',
}));
const response = (runs = greenRuns()) => ({
  total_count: runs.length,
  workflow_runs: runs,
});

function check(payload) {
  const folder = mkdtempSync(join(tmpdir(), 'chronicles-signal-schema-'));
  try {
    const gh = join(folder, 'gh');
    const output = join(folder, 'output');
    const summary = join(folder, 'summary');
    writeFileSync(gh, [
      '#!/bin/sh',
      'case "$*" in',
      '  *commits/main*) printf "%s\\n" "$FAKE_MAIN_SHA" ;;',
      '  *actions/runs*) printf "%s\\n" "$FAKE_RUNS" ;;',
      '  *) exit 40 ;;',
      'esac',
    ].join('\n'));
    chmodSync(gh, 0o755);
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      timeout: 7000,
      env: {
        ...process.env,
        PATH: folder + delimiter + process.env.PATH,
        GH_TOKEN: 'source-token',
        SOURCE_SHA: sha,
        FAKE_MAIN_SHA: sha,
        FAKE_RUNS: typeof payload === 'string' ? payload : JSON.stringify(payload),
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    return {
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
      output: readFileSync(output, 'utf8'),
      summary: readFileSync(summary, 'utf8'),
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test('exact three trusted green workflows authorize source dispatch', () => {
  const result = check(response());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^ready=true$/m);
  assert.match(result.summary, /State: source CI green/);
});

test('valid incomplete source CI is waiting, not an API error', () => {
  const result = check(response(greenRuns().slice(0, 2)));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^ready=false$/m);
  assert.match(result.summary, /State: waiting for CI/);
});

test('schema errors and truncation fail visibly instead of appearing pending', () => {
  const samples = [
    { ...response(), total_count: 101 },
    { ...response(), total_count: 4 },
    { ...response(), total_count: '3' },
    { ...response(), workflow_runs: 'invalid' },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, workflow_id: 'wrong' } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 1 ? { ...run, repository: null } : run) },
    'invalid-json',
  ];
  for (const payload of samples) {
    const result = check(payload);
    assert.equal(result.status, 66, JSON.stringify(payload) + ': ' + result.stderr);
    assert.match(result.stderr, /CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD/);
    assert.doesNotMatch(result.output, /ready=/);
  }
});

test('real handoff enforces schema before interpreting any missing checks', () => {
  assert.ok(source.indexOf('CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD')
    < source.indexOf('Chronicles CD waiting for source CI'));
  assert.match(script, /total_count <= 100/);
  assert.match(script, /total_count == \(\$p\.workflow_runs \| length\)/);
  assert.match(source, /385763056,386812503,387132683/);
  assert.match(source, /GH_TOKEN="\$INFRA_ACTIONS_TOKEN" gh workflow run chronicles-api-staging\.yml/);
});
