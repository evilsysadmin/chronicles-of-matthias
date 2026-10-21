import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name) => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
const ci = read('ci.yml');
const frontend = read('react-frontend.yml');
const api = read('api.yml');

test('stale PR runs may cancel without cancelling required main checks', () => {
  const prOnly = 'cancel-in-progress: ' + String.fromCharCode(36) + "{{ github.event_name == 'pull_request' }}";
  for (const workflow of [ci, frontend]) {
    assert.match(workflow, /concurrency:\s*\n  group: chronicles-/);
    assert.ok(workflow.includes(prOnly));
    assert.match(workflow, /push:\s*\n    branches: \[main\]/);
    assert.match(workflow, /pull_request:/);
  }
});

test('both frontend-installing workflows use npm cache keyed to lockfile', () => {
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /cache: 'npm'\s*\n          cache-dependency-path: frontend\/package-lock\.json/);
    assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  }
});

test('protected checks and exact-SHA admission prerequisites are intact', () => {
  assert.match(ci, /repository-contract:/);
  assert.match(ci, /Require real frontend Vitest, build and Chromium smoke/);
  assert.match(frontend, /node smoke\/first-hour-contact\.mjs/);
  assert.match(api, /name: api-e2e/);
  assert.match(api, /needs: verify/);
});
