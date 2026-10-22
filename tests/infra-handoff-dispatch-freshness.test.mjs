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
const end = source.indexOf('\n      - name: Save successful staging dispatch receipt', commandFrom);
assert.ok(from > 0 && commandFrom > marker.length && end > commandFrom,
  'extract only the real dispatch step script');
const script = source.slice(commandFrom, end).split('\n').map((line) =>
  line.startsWith('          ') ? line.slice(10) : line,
).join('\n');

const SHA = 'a'.repeat(40);
const receiptName = (sha = SHA) => 'chronicles-infra-dispatch-' + sha;
const acceptedRun = () => ({
  id: 123, status: 'completed', conclusion: 'success',
  workflow_id: 389939241, head_sha: SHA,
  path: '.github/workflows/signal-shadowops-infra.yml',
  event: 'workflow_run', head_branch: 'main',
  repository: { full_name: 'evilsysadmin/chronicles-of-matthias' },
});
const receiptList = (sha = SHA) => ({
  total_count: 1, artifacts: [{
    name: receiptName(sha), expired: false, workflow_run: { id: 123 },
  }],
});

function simulate({
  current = SHA, sha = SHA, apiFails = false, infraToken = 'infra-token',
  pagesFails = false, receipts = { total_count: 0, artifacts: [] },
  priorRun = acceptedRun(), receiptApiFails = false,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chronicles-dispatch-'));
  try {
    const fakeGh = join(dir, 'gh');
    const recorded = join(dir, 'calls');
    const summary = join(dir, 'summary');
    const output = join(dir, 'output');
    const receiptFile = join(dir, 'receipt-list.json');
    const priorRunFile = join(dir, 'prior-run.json');
    writeFileSync(recorded, '');
    writeFileSync(summary, '');
    writeFileSync(output, '');
    writeFileSync(receiptFile, JSON.stringify(receipts));
    writeFileSync(priorRunFile, JSON.stringify(priorRun));
    writeFileSync(fakeGh, [
      '#!/bin/sh',
      'case "$1" in',
      '  api)',
      '    [ "$GH_TOKEN" = "source-read" ] || exit 11',
      '    case "$*" in',
      '      *commits/main*)',
      '        [ "$FAKE_API_FAILURE" = 0 ] || exit 12',
      '        printf "%s\\n" "$FAKE_MAIN_SHA" ;;',
      '      *actions/artifacts*)',
      '        [ "$FAKE_RECEIPT_FAILURE" = 0 ] || exit 15',
      '        cat "$FAKE_RECEIPTS" ;;',
      '      *actions/runs/123*) cat "$FAKE_PRIOR_RUN" ;;',
      '      *) exit 14 ;;',
      '    esac ;;',
      '  workflow)',
      '    [ "$GH_TOKEN" = "infra-token" ] || exit 13',
      '    printf "%s\\n" "$*" >> "$FAKE_GH_CALLS"',
      '    case "$*" in',
      '      *chronicles-pages-release.yml*)',
      '        [ "$FAKE_PAGES_FAILURE" = 0 ] || exit 16 ;;',
      '    esac ;;',
      '  *) exit 14 ;;',
      'esac',
      '',
    ].join('\n'));
    chmodSync(fakeGh, 0o755);
    const run = spawnSync('bash', ['-c', script], {
      cwd: dir, encoding: 'utf8', timeout: 6000,
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        SOURCE_SHA: sha,
        SOURCE_READ_TOKEN: 'source-read',
        INFRA_ACTIONS_TOKEN: infraToken,
        FAKE_GH_CALLS: recorded,
        FAKE_MAIN_SHA: current,
        FAKE_API_FAILURE: apiFails ? '1' : '0',
        FAKE_RECEIPT_FAILURE: receiptApiFails ? '1' : '0',
        FAKE_PAGES_FAILURE: pagesFails ? '1' : '0',
        FAKE_RECEIPTS: receiptFile,
        FAKE_PRIOR_RUN: priorRunFile,
        GITHUB_STEP_SUMMARY: summary,
        GITHUB_OUTPUT: output,
      },
    });
    const diskReceipt = join(dir, 'chronicles-dispatch-receipt.txt');
    const found = (() => {
      try { return readFileSync(diskReceipt, 'utf8'); } catch { return null; }
    })();
    return {
      status: run.status, stderr: run.stderr, stdout: run.stdout,
      calls: readFileSync(recorded, 'utf8').trim().split('\n').filter(Boolean),
      summary: readFileSync(summary, 'utf8'),
      output: readFileSync(output, 'utf8'),
      diskReceipt: found,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('first current SHA sends exactly API then Pages and writes a receipt after both', () => {
  assert.match(source, /SOURCE_READ_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(script, /GH_TOKEN="\$SOURCE_READ_TOKEN" gh api repos\/evilsysadmin\/chronicles-of-matthias\/commits\/main --jq \.sha/);
  assert.match(script, /CHRONICLES_DISPATCH_INVALID_MAIN_SHA/);
  const result = simulate();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
  assert.match(result.calls[0], /workflow run chronicles-api-staging\.yml/);
  assert.match(result.calls[1], /workflow run chronicles-pages-release\.yml/);
  for (const call of result.calls) {
    assert.match(call, /--repo evilsysadmin\/shadowops-infra --ref main/);
    assert.match(call, /-f source_sha=a{40}/);
    assert.match(call, /-f environment=staging/);
    assert.doesNotMatch(call, /production/);
  }
  assert.equal(result.output.trim(), 'sent=true');
  assert.equal(result.diskReceipt, SHA + '\n');
});

test('trusted completed prior handoff suppresses both duplicate dispatches', () => {
  const result = simulate({ receipts: receiptList() });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, []);
  assert.equal(result.output, '');
  assert.equal(result.diskReceipt, null);
  assert.match(result.stdout, /CHRONICLES_DISPATCH_ALREADY_SENT/);
  assert.match(result.summary, /previously dispatched/);
});

test('failed prior workflow and partial Pages dispatch can retry', () => {
  const failed = simulate({
    receipts: receiptList(),
    priorRun: { ...acceptedRun(), conclusion: 'failure' },
  });
  assert.equal(failed.status, 0, failed.stderr);
  assert.equal(failed.calls.length, 2);
  const partial = simulate({ pagesFails: true });
  assert.equal(partial.status, 16, partial.stderr);
  assert.equal(partial.calls.length, 2);
  assert.equal(partial.diskReceipt, null);
  assert.doesNotMatch(partial.output, /sent=true/);
});

test('untrusted or different-SHA receipt cannot suppress the current staging dispatch', () => {
  const changes = [
    { path: '.github/workflows/ci.yml' },
    { workflow_id: 386812503 },
    { head_sha: 'b'.repeat(40) },
    { repository: { full_name: 'someone/untrusted' } },
    { status: 'in_progress', conclusion: null },
  ];
  for (const changed of changes) {
    const result = simulate({
      receipts: receiptList(),
      priorRun: { ...acceptedRun(), ...changed },
    });
    assert.equal(result.status, 0, JSON.stringify(changed) + ': ' + result.stderr);
    assert.equal(result.calls.length, 2, JSON.stringify(changed));
    assert.match(result.output, /sent=true/);
  }
});

test('malformed receipt origin responses fail closed instead of triggering another dispatch', () => {
  const badOrigins = [
    { ...acceptedRun(), id: '123' },
    { ...acceptedRun(), workflow_id: '389939241' },
    { ...acceptedRun(), head_sha: 'not-a-git-sha' },
    { ...acceptedRun(), head_sha: null },
    { ...acceptedRun(), path: null },
    { ...acceptedRun(), repository: null },
    { ...acceptedRun(), event: null },
    { ...acceptedRun(), status: null },
    { ...acceptedRun(), conclusion: { value: 'success' } },
    'not-an-object',
  ];
  for (const priorRun of badOrigins) {
    const result = simulate({ receipts: receiptList(), priorRun });
    assert.equal(result.status, 67, JSON.stringify(priorRun) + ': ' + result.stderr);
    assert.deepEqual(result.calls, [], 'Malformed receipt origin may conceal previous dispatch');
    assert.match(result.stderr, /CHRONICLES_DISPATCH_ORIGIN_INCONCLUSIVE/);
    assert.doesNotMatch(result.output, /sent=true/);
  }
});

test('trusted dispatch receipt requires exact workflow identity and source SHA', () => {
  assert.match(script, /\.workflow_id == 389939241/);
  assert.match(script, /\.head_sha == \$sha/);
  assert.match(script, /--arg sha "\$SOURCE_SHA"/);
});

test('unreadable, truncated and malformed receipt listings fail closed', () => {
  const unreadable = simulate({ receiptApiFails: true });
  assert.equal(unreadable.status, 15, unreadable.stderr);
  assert.deepEqual(unreadable.calls, []);

  const variants = [
    { total_count: 'broken', artifacts: [] },
    { total_count: 1, artifacts: [] }, // Missing receipt may be on another page.
    { total_count: 101, artifacts: [] }, // A one-page 100-item query is insufficient.
    { total_count: -1, artifacts: [] },
    { total_count: 0, artifacts: 'wrong-type' },
    { total_count: 1, artifacts: [{ name: receiptName(), expired: false }] },
    { total_count: 1, artifacts: [{ name: receiptName(), expired: 'no', workflow_run: { id: 123 } }] },
    { total_count: 1, artifacts: [{ name: receiptName(), expired: false, workflow_run: { id: '123' } }] },
    { total_count: 1, artifacts: [{ expired: false, workflow_run: { id: 123 } }] },
    // If the server ignores the name filter, its first page cannot prove
    // that an exact-SHA receipt is absent from a later result page.
    { total_count: 1, artifacts: [{
      name: receiptName('b'.repeat(40)), expired: false, workflow_run: { id: 123 },
    }] },
  ];
  for (const receipts of variants) {
    const result = simulate({ receipts });
    assert.equal(result.status, 66, JSON.stringify(receipts) + ': ' + result.stderr);
    assert.deepEqual(result.calls, [], 'Inconclusive receipts cannot authorize staging dispatch');
    assert.match(result.stderr, /CHRONICLES_DISPATCH_RECEIPT_INCONCLUSIVE/);
    assert.doesNotMatch(result.output, /sent=true/);
  }
});

test('receipt listing must be complete and name-filtered before consulting prior runs or dispatching', () => {
  assert.match(script, /\$p\.total_count == \(\$p\.artifacts \| length\)/);
  assert.match(script, /\.name == \$name/);
  assert.match(script, /\$p\.total_count >= 0 and \$p\.total_count <= 100/);
  const validation = script.indexOf('CHRONICLES_DISPATCH_RECEIPT_INCONCLUSIVE');
  const apiDispatch = script.indexOf('gh workflow run chronicles-api-staging.yml');
  assert.ok(validation >= 0 && apiDispatch > validation);
});

test('expired exact-SHA receipt permits a new dispatch; foreign name does not', () => {
  const expired = simulate({
    receipts: { total_count: 1, artifacts: [{
      name: receiptName(), expired: true, workflow_run: { id: 123 },
    }] },
  });
  assert.equal(expired.status, 0, expired.stderr);
  assert.equal(expired.calls.length, 2);

  const other = simulate({ receipts: { total_count: 1, artifacts: [{
    name: receiptName('c'.repeat(40)), expired: false, workflow_run: { id: 123 },
  }] } });
  assert.equal(other.status, 66, other.stderr);
  assert.deepEqual(other.calls, []);
  assert.match(other.stderr, /CHRONICLES_DISPATCH_RECEIPT_INCONCLUSIVE/);
});

test('superseded SHA and GitHub main verification failure never dispatch', () => {
  const stale = simulate({ current: 'b'.repeat(40) });
  assert.equal(stale.status, 0, stale.stderr);
  assert.deepEqual(stale.calls, []);
  assert.match(stale.summary, /superseded before dispatch/);
  const malformed = simulate({ current: 'wrong-sha' });
  assert.equal(malformed.status, 65, malformed.stderr);
  assert.deepEqual(malformed.calls, []);
  const down = simulate({ apiFails: true });
  assert.equal(down.status, 12, down.stderr);
  assert.deepEqual(down.calls, []);
});

test('invalid source SHA or missing infra token never dispatches', () => {
  const badSha = simulate({ sha: 'not-a-sha' });
  assert.equal(badSha.status, 64);
  assert.deepEqual(badSha.calls, []);
  const noToken = simulate({ infraToken: '' });
  assert.equal(noToken.status, 1);
  assert.deepEqual(noToken.calls, []);
  assert.match(noToken.summary, /dispatch failed/);
});

test('only a complete successful dispatch may upload its SHA receipt', () => {
  assert.match(source, /id: dispatch/);
  assert.match(source, /if: steps\.dispatch\.outputs\.sent == 'true'/);
  assert.match(source, /uses: actions\/upload-artifact@v5/);
  assert.doesNotMatch(source, /actions\/upload-artifact@v4/);
  assert.match(source, /if: steps\.dispatch\.outputs\.sent == 'true'/);
  assert.match(source, /retention-days: 30/);
  assert.match(source, /name: chronicles-infra-dispatch-\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(source, /if-no-files-found: error/);
});
