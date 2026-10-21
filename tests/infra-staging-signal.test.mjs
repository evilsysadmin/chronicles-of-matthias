import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const workflow = readFileSync('.github/workflows/signal-shadowops-infra.yml', 'utf8');

test('source dispatch requires completed trusted main push and never checks out event code', () => {
  for (const piece of [
    'workflow_run:', 'types: [completed]', 'branches: [main]',
    "workflow_run.conclusion == 'success'",
    "workflow_run.event == 'push'",
    "workflow_run.head_branch == 'main'",
    "head_repository.full_name == 'evilsysadmin/chronicles-of-matthias'",
    'SOURCE_SHA: ${{ github.event.workflow_run.head_sha }}',
    'repos/evilsysadmin/chronicles-of-matthias/commits/main',
  ]) assert.ok(workflow.includes(piece), piece);
  assert.doesNotMatch(workflow, /actions\/checkout@/);
});


test('handoff retries whichever of the three required checks completes last', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const match = workflow.match(/    workflows:\n((?:      - .+\n)+)    types: \[completed\]/);
  assert.ok(match, 'workflow_run triggers must remain explicit');
  assert.deepEqual(match[1].trim().split('\n').map((line) => line.trim()), [
    '- Chronicles CI',
    '- Chronicles frontend',
    '- Chronicles API',
  ]);
  // Source CI already gates Chromium, but the independent frontend workflow
  // can complete after both CI and API. Its completion must wake the handoff.
  assert.match(ci, /Require real frontend Vitest, build and Chromium smoke for exact source SHA/);
  assert.match(ci, /completed:success\)/);
  // Receiving an event still cannot bypass the all-three-green admission.
  assert.match(workflow, /385763056,386812503,387132683/);
  assert.match(workflow, /all\(\.\[\];/);
  assert.match(workflow, /\$run.conclusion == "success"/);
});

test('source CI must finish before two fixed infra dispatches, never production', () => {
  for (const piece of [
    '385763056,386812503,387132683',
    'all(.[];',
    '$run.conclusion == "success"',
    'gh workflow run chronicles-api-staging.yml',
    'gh workflow run chronicles-pages-release.yml',
    '--repo evilsysadmin/shadowops-infra --ref main',
    '-f only_if_new=true',
    '-f environment=staging',
    'SHADOWOPS_INFRA_ACTIONS_TOKEN',
  ]) assert.ok(workflow.includes(piece), piece);
  assert.doesNotMatch(workflow, /-f environment=production/);
});

test('admission reports superseded, waiting and ready without claiming a deployment', () => {
  assert.match(workflow, /name: Verify source CI \(not a deployment\)/);
  assert.ok(workflow.includes("ready: \${{ steps.admit.outputs.ready }}"));
  for (const decision of [
    'State: superseded.', 'State: waiting for CI.', 'State: source CI green.',
    'GITHUB_STEP_SUMMARY', 'Chronicles frontend', 'Chronicles API',
  ]) assert.ok(workflow.includes(decision), decision);
});

test('dispatch is a separate gated job and missing token fails visibly', () => {
  assert.match(workflow, /dispatch:\n    name: Send staging API \+ Pages dispatch to Infra\n    needs: signal\n    if: needs.signal.outputs.ready == 'true'/);
  assert.match(workflow, /if \[\[ -z "\$INFRA_ACTIONS_TOKEN" \]\]; then/);
  assert.match(workflow, /SHADOWOPS_INFRA_ACTIONS_TOKEN is missing; hourly Infra polls remain active/);
  assert.ok(workflow.includes('::error title=Chronicles CD dispatch not sent'));
  assert.ok(workflow.includes('exit 1'));
  assert.ok(workflow.includes('State: dispatch sent.'));
  assert.ok(workflow.includes('This does not certify deployment'));
  assert.match(workflow, /permissions:\s+actions: read\s+contents: read/);
});

test('handoff rejects malformed GitHub main SHA instead of pretending it is obsolete', () => {
  const start = workflow.indexOf('          set -euo pipefail',
    workflow.indexOf('name: Require current protected source main with three green workflows'));
  const end = workflow.indexOf('          runs="$(gh api -X GET', start);
  assert.ok(start > 0 && end > start, 'extract the real handoff source freshness shell gate');
  const script = workflow.slice(start, end).split('\n').map(
    (line) => line.startsWith('          ') ? line.slice(10) : line,
  ).join('\n');
  assert.match(script, /\[\[ "\$head" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(script, /CHRONICLES_SIGNAL_INVALID_MAIN_SHA/);

  const folder = mkdtempSync(join(tmpdir(), 'chronicles-signal-'));
  try {
    const gh = join(folder, 'gh');
    writeFileSync(gh, '#!/bin/sh\nif [ "$FAKE_GH_FAILURE" = 1 ]; then exit 4; fi\nprintf "%s\\n" "$FAKE_MAIN_SHA"\n');
    chmodSync(gh, 0o755);
    const summary = join(folder, 'summary');
    const output = join(folder, 'output');
    const run = (current, fail = false) => {
      writeFileSync(summary, '');
      writeFileSync(output, '');
      const result = spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        timeout: 5000,
        env: {
          ...process.env,
          PATH: folder + delimiter + process.env.PATH,
          SOURCE_SHA: 'a'.repeat(40),
          FAKE_MAIN_SHA: current,
          FAKE_GH_FAILURE: fail ? '1' : '0',
          GITHUB_STEP_SUMMARY: summary,
          GITHUB_OUTPUT: output,
        },
      });
      return { ...result, output: readFileSync(output, 'utf8') };
    };
    const current = run('a'.repeat(40));
    assert.equal(current.status, 0, current.stderr);
    assert.doesNotMatch(current.output, /ready=false/);
    const stale = run('b'.repeat(40));
    assert.equal(stale.status, 0, stale.stderr);
    assert.match(stale.output, /ready=false/);
    const malformed = run('not-a-sha');
    assert.equal(malformed.status, 65, malformed.stderr);
    assert.match(malformed.stderr, /CHRONICLES_SIGNAL_INVALID_MAIN_SHA/);
    assert.doesNotMatch(malformed.output, /ready=false/);
    assert.equal(run('a'.repeat(40), true).status, 4);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
