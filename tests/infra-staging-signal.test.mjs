import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
