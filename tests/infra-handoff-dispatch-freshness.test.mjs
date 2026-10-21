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
const stepName = '      - name: Dispatch only the two dedicated staging CD workflows';
const from = source.indexOf(stepName);
const marker = '        run: |\n';
const commandFrom = source.indexOf(marker, from) + marker.length;
assert.ok(from > 0 && commandFrom > marker.length, 'dispatch step exists');
const script = source.slice(commandFrom).split('\n').map((line) =>
  line.startsWith('          ') ? line.slice(10) : line,
).join('\n');

function simulate({ current = 'a'.repeat(40), sha = 'a'.repeat(40), apiFails = false, infraToken = 'infra-token' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chronicles-dispatch-'));
  try {
    const fakeGh = join(dir, 'gh');
    const recorded = join(dir, 'calls');
    const summary = join(dir, 'summary');
    writeFileSync(recorded, '');
    writeFileSync(summary, '');
    writeFileSync(fakeGh, [
      '#!/bin/sh',
      'case "$1" in',
      '  api)',
      '    [ "$GH_TOKEN" = "source-read" ] || exit 11',
      '    [ "$FAKE_API_FAILURE" = 0 ] || exit 12',
      '    printf "%s\\n" "$FAKE_MAIN_SHA" ;;',
      '  workflow)',
      '    [ "$GH_TOKEN" = "infra-token" ] || exit 13',
      '    printf "%s\\n" "$*" >> "$FAKE_GH_CALLS" ;;',
      '  *) exit 14 ;;',
      'esac',
      '',
    ].join('\n'));
    chmodSync(fakeGh, 0o755);
    const run = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      timeout: 6000,
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        SOURCE_SHA: sha,
        SOURCE_READ_TOKEN: 'source-read',
        INFRA_ACTIONS_TOKEN: infraToken,
        FAKE_GH_CALLS: recorded,
        FAKE_MAIN_SHA: current,
        FAKE_API_FAILURE: apiFails ? '1' : '0',
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    return {
      status: run.status,
      stderr: run.stderr,
      stdout: run.stdout,
      calls: readFileSync(recorded, 'utf8').trim().split('\n').filter(Boolean),
      summary: readFileSync(summary, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('source handoff dispatch checks protected main with read token before Infra token', () => {
  assert.match(source, /SOURCE_READ_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(script, /GH_TOKEN="\$SOURCE_READ_TOKEN" gh api repos\/evilsysadmin\/chronicles-of-matthias\/commits\/main --jq \.sha/);
  assert.match(script, /CHRONICLES_DISPATCH_INVALID_MAIN_SHA/);
  const result = simulate();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2, 'one API staging and one Pages staging dispatch');
  assert.match(result.calls[0], /workflow run chronicles-api-staging\.yml/);
  assert.match(result.calls[1], /workflow run chronicles-pages-release\.yml/);
  for (const call of result.calls) {
    assert.match(call, /--repo evilsysadmin\/shadowops-infra --ref main/);
    assert.match(call, /-f source_sha=a{40}/);
    assert.match(call, /-f environment=staging/);
    assert.doesNotMatch(call, /production/);
  }
});

test('newer protected-main commit skips both staging dispatches and labels superseded', () => {
  const result = simulate({ current: 'b'.repeat(40) });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, []);
  assert.match(result.summary, /superseded before dispatch/);
  assert.match(result.stdout, /Skipped obsolete/);
});

test('malformed main SHA and API failure fail closed without a dispatch', () => {
  const invalid = simulate({ current: 'wrong-sha' });
  assert.equal(invalid.status, 65);
  assert.deepEqual(invalid.calls, []);
  assert.match(invalid.stderr, /CHRONICLES_DISPATCH_INVALID_MAIN_SHA/);
  const apiDown = simulate({ apiFails: true });
  assert.equal(apiDown.status, 12);
  assert.deepEqual(apiDown.calls, []);
});

test('bad source SHA or missing infra token never dispatches', () => {
  const badSource = simulate({ sha: 'not-a-sha' });
  assert.equal(badSource.status, 64);
  assert.deepEqual(badSource.calls, []);
  const missingToken = simulate({ infraToken: '' });
  assert.equal(missingToken.status, 1);
  assert.deepEqual(missingToken.calls, []);
  assert.match(missingToken.summary, /dispatch failed/);
});
