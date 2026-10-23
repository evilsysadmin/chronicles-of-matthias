import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const stepName = '\n      - name: Reject unsafe legacy OpenPGP imports\n';

function hasRequiredOpenPGPGuard(source) {
  const job = source.indexOf('\n  verify:\n');
  const build = source.indexOf('\n      - name: Build and vet (amd64 + arm64)\n', job);
  const guard = source.indexOf(stepName, job);
  const scanner = source.indexOf('\n      - name: Go vulnerability scan (reachable source paths)\n', job);
  if (job < 0 || build < job || guard <= build || scanner <= guard || source.indexOf(stepName, guard + 1) >= 0) return false;
  const step = source.slice(guard + stepName.length, scanner);
  return /^\s*working-directory: api\s*$/m.test(step)
    && /^\s*shell: bash\s*$/m.test(step)
    && /^\s*run: \|\s*$/m.test(step)
    && /^\s*set -euo pipefail\s*$/m.test(step)
    && step.includes('for arch in amd64 arm64; do')
    && step.includes('CGO_ENABLED=0 GOOS=linux GOARCH="$arch" GOTOOLCHAIN=local go list -deps ./cmd/chronicles-api')
    && step.includes('grep -Eq')
    && step.includes('^golang[.]org/x/crypto/openpgp(/|$)')
    && step.includes('<<< "$deps"')
    && step.includes('GO-2026-5932 unsafe OpenPGP import')
    && /^\s*exit 1\s*$/m.test(step)
    && !/continue-on-error:/.test(step)
    && !/\|\|\s*(?:true|:)(?:\s|$)/m.test(step);
}

test('required API CI rejects unsafe OpenPGP imports in both Go target architectures', () => {
  assert.ok(hasRequiredOpenPGPGuard(workflow));
});

test('legacy OpenPGP guard rejects removal, architecture downgrades, and suppressed exits', () => {
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace(stepName, '')), false);
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace('for arch in amd64 arm64; do', 'for arch in amd64; do')), false);
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace('openpgp(/|$)', 'ssh(/|$)')), false);
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace('go list -deps ./cmd/chronicles-api', 'echo skipped')), false);
  const fail = 'echo "::error::GO-2026-5932 unsafe OpenPGP import in linux/$arch API"\n              exit 1';
  assert.ok(workflow.includes(fail));
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace(fail, fail.replace('exit 1', 'exit 0'))), false);
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace(fail, fail.replace('exit 1', 'exit 1 || true'))), false);
  assert.equal(hasRequiredOpenPGPGuard(workflow.replace(stepName, stepName + '        continue-on-error: true\n')), false);
});
