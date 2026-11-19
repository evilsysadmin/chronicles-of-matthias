import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/public-staging-playtest.yml', import.meta.url), 'utf8',
);

test('Chronicles source does not duplicate Infra daily playtest scheduling', () => {
  const triggers = workflow.match(/^on:\n((?:[ \t]+.*\n)*)/m)?.[1] ?? '';
  assert.match(triggers, /^  workflow_dispatch:/m);
  assert.doesNotMatch(triggers, /^  schedule:/m);
  assert.match(workflow, /shadowops-infra \(chronicles-autonomous-playtest\.yml\)/);
});

test('manual source playtest remains fail-closed and pinned to the public release', () => {
  assert.match(workflow, /ref: \$\{\{ steps\.release\.outputs\.sha \}\}/);
  assert.match(workflow, /CHRONICLES_STAGING_INVITE_CODE: \$\{\{ secrets\.CHRONICLES_STAGING_INVITE_CODE \}\}/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" =/);
  assert.match(workflow, /Missing staging invite secret/);
  assert.match(workflow, /node smoke\/public-staging-playtest\.mjs/);
});
