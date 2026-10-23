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

test('required frontend and contract time budgets cover cached-browser E2E completion', () => {
  // Keep the source CI fail-closed, but avoid cancelling a passing browser
  // run immediately before its final artifact and checkout cleanup.
  assert.match(frontend, /timeout-minutes: 30/);
  assert.match(ci, /timeout-minutes: 40/);
  assert.match(ci, /for attempt in \$\(seq 1 216\)/);
  assert.match(ci, /sleep 10/);
  assert.match(ci, /completed:success\)/);
  assert.match(ci, /--retry-missing-official/);
});

test('both frontend-installing workflows use npm cache keyed to lockfile', () => {
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /cache: 'npm'\s*\n          cache-dependency-path: frontend\/package-lock\.json/);
    assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  }
});

test('new direct frontend check context is stable while the required bridge stays fail-closed', () => {
  assert.ok(frontend.includes('    name: frontend-vitest-build-chromium'));
  assert.ok(ci.includes('check_name=frontend-vitest-build-chromium'));
  assert.ok(ci.includes('Require real frontend Vitest, build and Chromium smoke'));
  assert.ok(ci.includes('node scripts/require-frontend-workflow.mjs'));
  assert.ok(ci.includes('for attempt in $(seq 1 216)'));
  assert.ok(!ci.includes('check_name=build '));
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

test('API and frontend E2E use npm-ci locked exact Playwright with tested Chromium host readiness', () => {
  const pkg = JSON.parse(readFileSync(new URL('../frontend/package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../frontend/package-lock.json', import.meta.url), 'utf8'));
  const version = '1.64.1';
  assert.equal(pkg.devDependencies.playwright, version);
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].devDependencies.playwright, version);
  for (const name of ['playwright', 'playwright-core']) {
    const entry = lock.packages['node_modules/' + name];
    assert.equal(entry?.version, version, name + ' must match pinned release');
    assert.match(entry?.integrity ?? '', /^sha512-/);
  }
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
    assert.match(workflow, /bash smoke\/ensure-chromium\.sh/);
    assert.doesNotMatch(workflow, /npm install --no-save|npm install --package-lock-only|playwright@\^|playwright@~/);
    assert.doesNotMatch(workflow, /CHRONICLES_LOCKCHUNK|Bootstrap exact Playwright lockfile/);
  }
});

test('Go API health readiness shares the bounded liveness and log-aware probe', () => {
  assert.match(api, /source frontend\/smoke\/wait-for-http\.sh/);
  assert.match(api, /api_pid=\$!/);
  assert.match(api, /wait_for_http http:\/\/127\.0\.0\.1:8090\/api\/health "\$api_pid" "\$RUNNER_TEMP\/api\.log" "Go API health"/);
  assert.doesNotMatch(api, /for i in \$\(seq 1 40\); do curl/);
  assert.match(api, /curl -fsS http:\/\/127\.0\.0\.1:8090\/api\/health/);
});

test('Chromium cache key comes from installed npm-locked Playwright in both E2Es', () => {
  const dollar = String.fromCharCode(36);
  const expectedKey = 'chronicles-playwright-' + dollar + '{{ runner.os }}-' + dollar + '{{ runner.arch }}-' + dollar + '{{ steps.playwright_version.outputs.version }}';
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /uses: actions\/cache@v5/);
    assert.match(workflow, /path: ~\/\.cache\/ms-playwright/);
    assert.ok(workflow.includes('key: ' + expectedKey));
    assert.match(workflow, /id: playwright_version/);
    assert.match(workflow, /node -p "require\('\.\/node_modules\/playwright\/package\.json'\)\.version"/);
    assert.match(workflow, /node -p "require\('\.\/package\.json'\)\.devDependencies\.playwright"/);
    assert.match(workflow, /\[\[ "\$version" == "\$declared" \]\]/);
    assert.match(workflow, /bash smoke\/ensure-chromium\.sh/);
    assert.doesNotMatch(workflow, /restore-keys:/);
    const npmInstall = workflow.indexOf('npm ci --ignore-scripts');
    const keyDerivation = workflow.indexOf('Resolve locked Playwright version for browser cache');
    const cache = workflow.indexOf('Restore pinned Playwright Chromium browser');
    assert.ok(npmInstall >= 0 && keyDerivation > npmInstall && cache > keyDerivation);
  }
});

test('first-party workflow actions use Node 24-compatible releases', () => {
  for (const workflow of [ci, frontend, api]) {
    assert.match(workflow, /actions\/checkout@v5/);
    assert.match(workflow, /actions\/setup-node@v5/);
    assert.doesNotMatch(workflow, /actions\/checkout@v4|actions\/setup-node@v4|actions\/setup-go@v5|actions\/cache@v4|actions\/upload-artifact@v4/);
  }
  assert.match(api, /actions\/setup-go@v6/);
  // Docker publish actions must use their Node 24 native majors.
  assert.match(api, /uses: docker\/setup-buildx-action@v4/);
  assert.match(api, /uses: docker\/login-action@v4/);
  assert.doesNotMatch(api, /docker\/(?:setup-buildx-action|login-action)@v3/);
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /actions\/cache@v5/);
    assert.match(workflow, /actions\/upload-artifact@v5/);
  }
});

test('API main SHA verification does not cancel when newer main commits arrive', () => {
  const expectedCancellation = 'cancel-in-progress: ' + String.fromCharCode(36) + "{{ github.event_name == 'pull_request' }}";
  assert.match(api, /group: chronicles-api-[^\n]+\|\| github\.run_id \}\}/);
  assert.match(api, /github\.event_name == 'pull_request' && github\.event\.pull_request\.number/);
  assert.ok(api.includes(expectedCancellation));
  assert.doesNotMatch(api, /group: chronicles-api-\$\{\{ github\.ref \}\}/);
});

test('obsolete API images cannot publish or attest without exact-SHA main admission', () => {
  const job = api.slice(api.indexOf('\n  publish:\n'));
  assert.match(job, /needs: verify/);
  assert.match(job, /Require current main SHA before Docker publication/);
  assert.match(job, /gh api "repos\/\$GITHUB_REPOSITORY\/commits\/main" --jq \.sha/);
  assert.match(job, /\[\[ "\$GITHUB_SHA" != "\$current" \]\]/);
  assert.match(job, /publish=false/);
  assert.match(job, /publish=true/);
  const gated = (job.match(/^\s+if: steps\.admission\.outputs\.publish == 'true'$/gm) || []).length;
  assert.equal(gated, 6, 'checkout, Buildx, login, build, provenance and summary must stay gated');
  assert.match(job, /CHRONICLES_SOURCE_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(job, /push-to-registry: true/);
});


test('a single shared browser bootstrap checks real host readiness before apt fallback', () => {
  const script = readFileSync(new URL('../frontend/smoke/ensure-chromium.sh', import.meta.url), 'utf8');
  const probe = readFileSync(new URL('../frontend/smoke/chromium-host-probe.mjs', import.meta.url), 'utf8');
  assert.match(script, /npx playwright install chromium/);
  assert.match(script, /node smoke\/chromium-host-probe\.mjs/);
  assert.match(script, /42\)/);
  assert.match(script, /npx playwright install-deps chromium/);
  assert.doesNotMatch(script, /install --with-deps chromium/);
  assert.match(probe, /chromium\.launch\(/);
  assert.match(probe, /Missing libraries:/);
  assert.match(probe, /process\.exitCode = missingHostDeps \? 42 : 1/);
  for (const workflow of [frontend, api]) {
    assert.match(workflow, /bash smoke\/ensure-chromium\.sh/);
  }
});

test('main-only API image publication uses a non-blocking multi-arch BuildKit cache', () => {
  const publish = api.slice(api.indexOf('\n  publish:\n'));
  assert.match(publish, /needs: verify/);
  assert.match(publish, /if: github\.event_name != 'pull_request'/);
  assert.match(publish, /cache-from: type=gha,scope=chronicles-api-buildkit-v1/);
  assert.match(publish, /cache-to: type=gha,mode=max,scope=chronicles-api-buildkit-v1,ignore-error=true/);
  assert.doesNotMatch(api.slice(0, api.indexOf('\n  publish:\n')), /cache-to: type=gha/);
  assert.match(publish, /CHRONICLES_SOURCE_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(publish, /push-to-registry: true/);
});
