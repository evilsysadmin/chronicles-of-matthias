import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/staging-image.yml', 'utf8');

test('image publication is restricted to trusted main SHA, never PRs', () => {
  assert.match(workflow, /on:\n  pull_request:\n  push:\n    branches: \[main\]/);
  assert.match(workflow, /needs: staging-image-policy/);
  assert.ok(workflow.includes("github.event_name == 'push'"));
  assert.ok(workflow.includes("github.ref == 'refs/heads/main'"));
  assert.ok(workflow.includes("github.repository == 'evilsysadmin/chronicles-of-matthias'"));
  assert.ok(workflow.includes('TAG: staging-${{ github.sha }}'));
  assert.ok(workflow.includes('IMAGE: ghcr.io/evilsysadmin/chronicles-api'));
  assert.doesNotMatch(workflow, /:latest\b|:production\b|:prod\b/);
});

test('publish job has a complete independent quality gate', () => {
  for (const expected of [
    'npm test',
    'go mod tidy',
    'git diff --exit-code -- go.mod go.sum',
    'go test ./...',
    'CGO_ENABLED=0 go build',
    'docker build --pull',
    '/api/chronicles/runs',
    "docker inspect chronicles-stage-preflight --format '{{.Config.User}}'",
    'org.opencontainers.image.revision',
    'docker push "$IMAGE:$TAG"',
  ]) {
    assert.ok(workflow.includes(expected), `Missing pre-publish check: ${expected}`);
  }
  assert.ok(workflow.indexOf('go test ./...') < workflow.indexOf('docker push "$IMAGE:$TAG"'));
  assert.ok(workflow.indexOf('docker build --pull') < workflow.indexOf('docker push "$IMAGE:$TAG"'));
});

test('staging publication is digest pinned, attested, and cannot deploy production', () => {
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /attestations: write/);
  assert.ok(workflow.includes('actions/attest@v4'));
  assert.ok(workflow.includes('push-to-registry: true'));
  assert.ok(workflow.includes('subject-name: ghcr.io/evilsysadmin/chronicles-api'));
  assert.ok(workflow.includes('subject-digest: ${{ steps.push.outputs.digest }}'));
  assert.match(workflow, /sha256:\[a-f0-9\]\{64\}/);
  assert.doesNotMatch(workflow, /docker compose up|kubectl apply|oci .*deploy|render\.com/);
  assert.doesNotMatch(workflow, /docker exec[^\n]+id -u/);
});
