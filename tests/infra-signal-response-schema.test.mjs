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
const identities = [
  { name: 'Chronicles CI', path: '.github/workflows/ci.yml' },
  { name: 'Chronicles frontend', path: '.github/workflows/react-frontend.yml' },
  { name: 'Chronicles API', path: '.github/workflows/api.yml' },
];
const greenRuns = () => ids.map((workflow_id, index) => ({
  id: 100 + index,
  workflow_id,
  ...identities[index],
  head_sha: sha,
  updated_at: `2026-10-22T11:00:0${index}Z`,
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

function check(payload, triggerRunId = '102') {
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
        SOURCE_WORKFLOW_RUN_ID: triggerRunId,
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

test('only the final trusted CI completion may own a staging dispatch', () => {
  const completed = response();
  const last = check(completed, '102');
  assert.equal(last.status, 0, last.stderr);
  assert.match(last.output, /^ready=true$/m);

  for (const earlier of ['100', '101']) {
    const result = check(completed, earlier);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.output, /^ready=false$/m);
    assert.match(result.summary, /another source CI run owns dispatch/);
  }

  // Completion order is not the same as workflow ID or run creation order.
  const reordered = greenRuns();
  reordered[0].updated_at = '2026-10-22T11:05:00Z';
  reordered[2].updated_at = '2026-10-22T11:03:00Z';
  assert.match(check(response(reordered), '100').output, /^ready=true$/m);
  assert.match(check(response(reordered), '102').output, /^ready=false$/m);

  // Timestamp ties fall back to immutable run ID, not array order.
  reordered.forEach((item) => { item.updated_at = '2026-10-22T11:00:00Z'; });
  assert.match(check(response(reordered.reverse()), '102').output, /^ready=true$/m);
});

test('invalid trigger run and missing trustworthy completion time fail closed', () => {
  const invalid = check(response(), 'invalid');
  assert.equal(invalid.status, 67, invalid.stderr);
  assert.doesNotMatch(invalid.output, /ready=true/);

  const missingTimestamp = response(greenRuns().map((item, i) =>
    i === 0 ? { ...item, updated_at: null } : item));
  const bad = check(missingTimestamp);
  assert.equal(bad.status, 66, bad.stderr);
  assert.match(bad.stderr, /CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD/);
  assert.doesNotMatch(bad.output, /ready=true/);
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
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, id: -1 } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, id: 0 } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, id: 103.5 } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, workflow_id: -386812503 } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, workflow_id: 386812503.25 } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, head_sha: 'not-a-git-sha' } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, head_branch: null } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 0 ? { ...run, name: 'Other CI' } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 1 ? { ...run, path: '.github/workflows/fake.yml' } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 2 ? { ...run, path: null } : run) },
    { ...response(), workflow_runs: greenRuns().map((run, i) =>
      i === 1 ? { ...run, name: null } : run) },
    'invalid-json',
  ];
  for (const payload of samples) {
    const result = check(payload);
    assert.equal(result.status, 66, JSON.stringify(payload) + ': ' + result.stderr);
    assert.match(result.stderr, /CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD/);
    assert.doesNotMatch(result.output, /ready=/);
  }
});

test('malformed newest official run cannot be ignored in favour of older success', () => {
  const olderGreen = greenRuns();
  const badNewer = { ...olderGreen[1], id: 0, conclusion: 'failure' };
  const payload = response([...olderGreen, badNewer]);
  const result = check(payload);
  assert.equal(result.status, 66, result.stderr);
  assert.match(result.stderr, /CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD/);
  assert.doesNotMatch(result.output, /ready=true|ready=false/);
});

test('newest mismatched source workflow cannot borrow an older green identity', () => {
  for (const altered of [
    { name: 'Chronicles CI spoofed' },
    { path: '.github/workflows/untrusted-ci.yml' },
  ]) {
    const valid = greenRuns();
    // A lower-ID run is valid and green. Newer evidence using the same
    // immutable workflow ID must fail closed rather than be ignored.
    const newer = { ...valid[0], id: 200, ...altered };
    const result = check(response([...valid, newer]), '102');
    assert.equal(result.status, 66, JSON.stringify(altered) + ': ' + result.stderr);
    assert.match(result.stderr, /CHRONICLES_SIGNAL_INVALID_RUNS_PAYLOAD/);
    assert.doesNotMatch(result.output, /ready=true|ready=false/);
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
