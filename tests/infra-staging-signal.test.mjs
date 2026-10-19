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

test('cross repo dispatch is optional without a token and source permissions are read only', () => {
  assert.match(workflow, /if \[\[ -z "\$INFRA_ACTIONS_TOKEN" \]\]; then/);
  assert.match(workflow, /permissions:\s+actions: read\s+contents: read/);
  assert.ok(workflow.includes('hourly Infra polls remain active'));
});
