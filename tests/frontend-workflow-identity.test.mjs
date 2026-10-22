import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FRONTEND_WORKFLOW_ID, verifyFrontendWorkflow,
} from '../scripts/require-frontend-workflow.mjs';

const SHA = 'a'.repeat(40);
const REPO = 'evilsysadmin/chronicles-of-matthias';
const opts = { sha: SHA, event: 'pull_request', repository: REPO };
const run = (overrides = {}) => ({
  id: 42,
  workflow_id: FRONTEND_WORKFLOW_ID,
  head_sha: SHA,
  head_branch: 'feature/chess',
  event: 'pull_request',
  repository: { full_name: REPO },
  status: 'completed',
  conclusion: 'success',
  ...overrides,
});
const response = (...runs) => ({ total_count: runs.length, workflow_runs: runs });

test('accepts only the official frontend workflow from the expected PR and repository', () => {
  assert.equal(verifyFrontendWorkflow(response(
    run({ id: 44, workflow_id: 999 }),
    run({ id: 45, event: 'push', head_branch: 'main' }),
    run({ id: 42 }),
  ), opts), 42);
});

test('accepts a successful protected-main push with branch main', () => {
  assert.equal(verifyFrontendWorkflow(
    response(run({ event: 'push', head_branch: 'main' })),
    { ...opts, event: 'push' },
  ), 42);
});

test('rejects a green build from another Actions workflow', () => {
  assert.throws(() => verifyFrontendWorkflow(
    response(run({ workflow_id: 42 })),
    opts,
  ), /not green/);
});

test('rejects different source SHA, event, repository and non-main push', () => {
  for (const changed of [
    { head_sha: 'b'.repeat(40) },
    { event: 'push' },
    { repository: { full_name: 'someone/other-repo' } },
  ]) {
    assert.throws(() => verifyFrontendWorkflow(response(run(changed)), opts), /not green/);
  }
  assert.throws(() => verifyFrontendWorkflow(
    response(run({ event: 'push', head_branch: 'other' })),
    { ...opts, event: 'push' },
  ), /not green/);
});

test('rejects latest frontend rerun when pending, cancelled, or failed', () => {
  for (const revised of [
    { status: 'in_progress', conclusion: null },
    { status: 'completed', conclusion: 'cancelled' },
    { status: 'completed', conclusion: 'failure' },
  ]) {
    assert.throws(() => verifyFrontendWorkflow(
      response(run({ id: 10 }), run({ id: 11, ...revised })), opts,
    ), /not green/);
  }
});

test('rejects truncated, malformed and excessive workflow-run data', () => {
  for (const payload of [
    {}, { total_count: 101, workflow_runs: [] },
    { total_count: 0, workflow_runs: 'wrong' },
    { total_count: null, workflow_runs: [] },
    // A hidden newer failed frontend run must never be concealed by a
    // truncated page containing only an older green run.
    { total_count: 2, workflow_runs: [run({ id: 10 })] },
    { total_count: 0, workflow_runs: [run()] },
  ]) assert.throws(() => verifyFrontendWorkflow(payload, opts), /Invalid/);
  assert.throws(() => verifyFrontendWorkflow(response(run()), {
    ...opts, sha: 'nonsense',
  }), /Invalid source/);
});

test('a truncated GitHub response cannot hide a newer failed Chromium run', () => {
  const oldGreen = run({ id: 20 });
  const newerFailed = run({ id: 21, status: 'completed', conclusion: 'failure' });
  assert.throws(
    () => verifyFrontendWorkflow({
      total_count: 2,
      workflow_runs: [oldGreen],
    }, opts),
    /Invalid or truncated/,
  );
  assert.throws(
    () => verifyFrontendWorkflow(response(oldGreen, newerFailed), opts),
    /not green/,
  );
  assert.equal(
    verifyFrontendWorkflow(response(oldGreen), opts),
    20,
    'a truly complete successful page remains accepted',
  );
});

test('rejects malformed workflow records instead of overlooking a newer failed run', () => {
  const oldGreen = run({ id: 42 });
  const badRecords = [
    null,
    { ...run({ id: 43, conclusion: 'failure' }), id: '43' },
    { ...run({ id: 43, conclusion: 'failure' }), id: 0 },
    { ...run({ id: 43, conclusion: 'failure' }), workflow_id: '386812503' },
    { ...run({ id: 43, conclusion: 'failure' }), head_sha: null },
    { ...run({ id: 43, conclusion: 'failure' }), event: null },
    { ...run({ id: 43, conclusion: 'failure' }), status: null },
    { ...run({ id: 43, conclusion: 'failure' }), conclusion: { result: 'failure' } },
    { ...run({ id: 43, conclusion: 'failure' }), repository: null },
  ];
  for (const bad of badRecords) {
    assert.throws(() => verifyFrontendWorkflow(response(oldGreen, bad), opts),
      /Invalid GitHub workflow-run record/,
      JSON.stringify(bad));
  }
  assert.throws(() => verifyFrontendWorkflow(
    response(oldGreen, run({ id: 43, conclusion: 'failure' })), opts),
    /not green/,
  );
  assert.equal(verifyFrontendWorkflow(response(oldGreen), opts), 42);
});

test('command line invocation verifies JSON stdin and fails closed', () => {
  const script = fileURLToPath(new URL('../scripts/require-frontend-workflow.mjs', import.meta.url));
  const call = (data) => spawnSync(process.execPath,
    [script, SHA, 'pull_request', REPO],
    { encoding: 'utf8', input: data, timeout: 5000 });
  const ok = call(JSON.stringify(response(run())));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /FRONTEND_WORKFLOW_IDENTITY_GREEN/);
  const bad = call(JSON.stringify(response(run({ workflow_id: 1 }))));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Frontend workflow identity not verified/);
  const truncated = call(JSON.stringify({
    total_count: 2, workflow_runs: [run({ id: 10 })],
  }));
  assert.equal(truncated.status, 1);
  assert.match(truncated.stderr, /Invalid or truncated/);
  const malformedRecord = call(JSON.stringify(response(
    run({ id: 10 }), { ...run({ id: 11 }), id: '11', conclusion: 'failure' },
  )));
  assert.equal(malformedRecord.status, 1);
  assert.match(malformedRecord.stderr, /Invalid GitHub workflow-run record/);
});

test('required repository-contract validates frontend check and workflow identity', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, /check_name=build/);
  assert.match(ci, /completed:success\)/);
  assert.match(ci, /actions\/runs"/);
  assert.match(ci, /-f head_sha="\$HEAD_SHA" -f event="\$GITHUB_EVENT_NAME"/);
  assert.match(ci, /node scripts\/require-frontend-workflow\.mjs/);
  assert.match(ci, /"\\?\$HEAD_SHA" "\\?\$GITHUB_EVENT_NAME"/);
  assert.match(ci, /FRONTEND_BROWSER_REQUIRED_GREEN/);
});
