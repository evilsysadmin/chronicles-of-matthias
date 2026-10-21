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
    // Main pushes must not inherit one long-lived concurrency group per ref.
    assert.match(workflow, /group: chronicles-[^\n]+\|\| github\.run_id \}\}/);
    assert.match(workflow, /github\.event_name == 'pull_request' && github\.event\.pull_request\.number/);
    assert.doesNotMatch(workflow, /github\.event\.pull_request\.number \|\| github\.ref/);
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

test('green main does not upload screenshots while PRs and failed main retain evidence', () => {
  const keepEvidence = 'if: ' + String.fromCharCode(36) + "{{ always() && (github.event_name == 'pull_request' || failure()) }}";
  for (const workflow of [frontend, api]) {
    assert.ok(workflow.includes(keepEvidence));
    assert.match(workflow, /compression-level: 0/);
    assert.match(workflow, /retention-days: 7/);
  }
  assert.match(frontend, /if: github\.event_name == 'pull_request'\n        with:\n          name: chronicles-frontend-dist/);
});

test('API and frontend E2E install the same exact Playwright release', () => {
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /npm install --no-save --no-audit --no-fund playwright@1\.64\.1(?:\r?\n|$)/);
    assert.match(workflow, /npx playwright install --with-deps chromium/);
    assert.doesNotMatch(workflow, /playwright@\^|playwright@~|playwright@1(?:\r?\n|$)/);
  }
});

test('Go API health readiness shares the bounded liveness and log-aware probe', () => {
  assert.match(api, /source frontend\/smoke\/wait-for-http\.sh/);
  assert.match(api, /api_pid=\$!/);
  assert.match(api, /wait_for_http http:\/\/127\.0\.0\.1:8090\/api\/health "\$api_pid" "\$RUNNER_TEMP\/api\.log" "Go API health"/);
  assert.doesNotMatch(api, /for i in \$\(seq 1 40\); do curl/);
  assert.match(api, /curl -fsS http:\/\/127\.0\.0\.1:8090\/api\/health/);
});

test('Chromium download cache is identical and exact-versioned for both browser suites', () => {
  const expectedKey = 'chronicles-playwright-' + String.fromCharCode(36) + '{{ runner.os }}-' + String.fromCharCode(36) + '{{ runner.arch }}-1.64.1';
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /uses: actions\/cache@v4/);
    assert.match(workflow, /path: ~\/\.cache\/ms-playwright/);
    assert.ok(workflow.includes('key: ' + expectedKey));
    assert.match(workflow, /npm install --no-save --no-audit --no-fund playwright@1\.64\.1/);
    assert.match(workflow, /npx playwright install --with-deps chromium/);
    assert.doesNotMatch(workflow, /restore-keys:/);
  }
});
