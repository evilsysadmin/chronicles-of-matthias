import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const header = '\n      - name: Go vulnerability scan (reachable source paths)\n';

function hasRequiredGoVulnerabilityScan(source) {
  const verifyAt = source.indexOf('\n  verify:\n');
  const scanAt = source.indexOf(header);
  if (verifyAt < 0 || scanAt < verifyAt || scanAt < 0 || source.indexOf(header, scanAt + 1) >= 0) {
    return false;
  }
  // A scan in another, optional job does not protect the required api-e2e lane.
  const following = source.slice(verifyAt + '\n  verify:\n'.length);
  const nextJobAt = following.search(/\n  [a-zA-Z_][\w-]*:\n/);
  if (nextJobAt >= 0 && scanAt >= verifyAt + '\n  verify:\n'.length + nextJobAt) return false;

  const tail = source.slice(scanAt + header.length);
  const nextStepAt = tail.search(/\n      - (?:name:|uses:)/);
  const step = nextStepAt < 0 ? tail : tail.slice(0, nextStepAt);
  return /^\s*working-directory: api\s*$/m.test(step)
    && /^\s*shell: bash\s*$/m.test(step)
    && /^\s*run: \|\s*$/m.test(step)
    && /^\s*set -euo pipefail\s*$/m.test(step)
    && /^\s*go install golang\.org\/x\/vuln\/cmd\/govulncheck@v1\.9\.0\s*$/m.test(step)
    && /^\s*"\$\(go env GOPATH\)\/bin\/govulncheck" -show verbose \.\/\.\.\.\s*$/m.test(step)
    && /^\s*GOOS=linux GOARCH=arm64 "\$\(go env GOPATH\)\/bin\/govulncheck" \.\/\.\.\.\s*$/m.test(step)
    && /^\s*"\$\(go env GOPATH\)\/bin\/govulncheck" -mode=binary "\$RUNNER_TEMP\/chronicles-api"\s*$/m.test(step)
    && /^\s*"\$\(go env GOPATH\)\/bin\/govulncheck" -mode=binary "\$RUNNER_TEMP\/chronicles-api-arm64"\s*$/m.test(step)
    && !/^\s*(?:if:|continue-on-error:)/m.test(step)
    && !/\|\|\s*(?:true|:)(?:\s|$)/m.test(step);
}

test('required Go API CI runs a pinned, fail-closed reachable vulnerability scan', () => {
  assert.ok(hasRequiredGoVulnerabilityScan(workflow),
    'api-e2e must scan both native and linux/arm64 Go source unconditionally and fail on findings');
});

test('the scanner contract rejects suppression, removal and non-pinned tools', () => {
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(header, '')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    header, header + '        continue-on-error: true\n')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    header, header + "        if: github.event_name == 'push'\n")), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    'govulncheck@v1.9.0', 'govulncheck@latest')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    '"$(go env GOPATH)/bin/govulncheck" -show verbose ./...',
    '"$(go env GOPATH)/bin/govulncheck" -show verbose ./... || true')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    '"$(go env GOPATH)/bin/govulncheck" -show verbose ./...', 'echo skipped')), false);
});

test('the scanner contract rejects missing or downgraded ARM64 coverage', () => {
  const arm64 = 'GOOS=linux GOARCH=arm64 "$(go env GOPATH)/bin/govulncheck" -show verbose ./...';
  assert.ok(workflow.includes(arm64), 'the required arm64 command must be present');
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(arm64, '')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(arm64,
    'GOOS=linux GOARCH=amd64 "$(go env GOPATH)/bin/govulncheck" -show verbose ./...')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(arm64,
    arm64 + ' || true')), false);
});

test('required CI rejects missing, suppressed or replaced binary vulnerability scans', () => {
  const amd64 = '"$(go env GOPATH)/bin/govulncheck" -mode=binary "$RUNNER_TEMP/chronicles-api"';
  const arm64 = '"$(go env GOPATH)/bin/govulncheck" -mode=binary "$RUNNER_TEMP/chronicles-api-arm64"';
  assert.ok(workflow.includes(amd64) && workflow.includes(arm64));
  for (const command of [amd64, arm64]) {
    assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(command, 'echo skipped')), false);
    assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(command, command + ' || true')), false);
  }
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace('-mode=binary', '-mode=source')), false);
});

test('verbose required module findings cannot be hidden', () => {
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace('-show verbose', '')), false);
});
