import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/public-staging-playtest.yml', import.meta.url), 'utf8');

test('staging invite is validated before browser tooling is installed', () => {
  const preflight = workflow.indexOf('name: Validate staging invitation configuration early');
  const install = workflow.indexOf('name: Install locked browser tooling');
  const chromium = workflow.indexOf('name: Install Chromium');
  const play = workflow.indexOf('name: Run real staging playtest');
  assert.ok(preflight >= 0 && preflight < install && install < chromium && chromium < play);
  const preflightBody = workflow.slice(preflight, install);
  assert.match(preflightBody, /CHRONICLES_STAGING_INVITE_CODE: \$\{\{ secrets\.CHRONICLES_STAGING_INVITE_CODE \}\}/);
  assert.match(preflightBody, /if \[\[ -z "\$\{CHRONICLES_STAGING_INVITE_CODE\}" \]\]/);
  assert.match(preflightBody, /exit 1/);
});

test('staging playtest remains read-only and publishes diagnostics', () => {
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /name: Reject unpublished or foreign source commits/);
  assert.match(workflow, /name: Publish diagnostic artifacts even on failure/);
  assert.match(workflow, /name: Summarize hard and soft outcomes/);
});
