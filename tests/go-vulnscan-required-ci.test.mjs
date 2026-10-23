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
    && /^\s*"\$\(go env GOPATH\)\/bin\/govulncheck" \.\/\.\.\.\s*$/m.test(step)
    && !/^\s*(?:if:|continue-on-error:)/m.test(step)
    && !/\|\|\s*(?:true|:)(?:\s|$)/m.test(step);
}

test('required Go API CI runs a pinned, fail-closed reachable vulnerability scan', () => {
  assert.ok(hasRequiredGoVulnerabilityScan(workflow),
    'api-e2e must run pinned govulncheck ./... unconditionally and fail on findings');
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
    '"$(go env GOPATH)/bin/govulncheck" ./...',
    '"$(go env GOPATH)/bin/govulncheck" ./... || true')), false);
  assert.equal(hasRequiredGoVulnerabilityScan(workflow.replace(
    '"$(go env GOPATH)/bin/govulncheck" ./...', 'echo skipped')), false);
});
