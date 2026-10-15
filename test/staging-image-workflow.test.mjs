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
    'docker buildx build --pull --platform linux/amd64,linux/arm64',
    '--push -t "$IMAGE:$TAG"',
    'docker buildx imagetools inspect --raw',
    'setup-qemu-action@v3',
    'setup-buildx-action@v3',
  ]) {
    assert.ok(workflow.includes(expected), `Missing pre-publish check: ${expected}`);
  }
  assert.ok(workflow.indexOf('go test ./...') < workflow.indexOf('--push -t "$IMAGE:$TAG"'));
  assert.ok(workflow.indexOf('docker build --pull') < workflow.indexOf('--push -t "$IMAGE:$TAG"'));
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
  assert.ok(workflow.includes('linux/amd64,linux/arm64'));
  assert.ok(workflow.includes('linux/arm64 --load'));
  assert.ok(workflow.includes('containerimage.digest'));
  assert.ok(workflow.includes('docker buildx imagetools inspect --raw'));
  assert.doesNotMatch(workflow, /docker compose up|kubectl apply|oci .*deploy|render\.com/);
  assert.doesNotMatch(workflow, /docker exec[^\n]+id -u/);
});

test('OCI A1 ARM64 and x86 images cross-compile from the same Dockerfile',()=>{
 const dockerfile=readFileSync('Dockerfile','utf8');
 const smoke=readFileSync('.github/workflows/go-container-smoke.yml','utf8');
 for(const token of [
  'FROM --platform=$BUILDPLATFORM',
  'ARG TARGETOS',
  'ARG TARGETARCH',
  'GOOS=$TARGETOS GOARCH=$TARGETARCH',
  'CGO_ENABLED=0',
  'FROM scratch',
  'USER 65532:65532'
 ]) assert.ok(dockerfile.includes(token),token);
 assert.ok(smoke.includes('docker buildx build --pull --platform linux/arm64 --load'));
 assert.ok(smoke.includes('docker/setup-qemu-action@v3'));
 assert.ok(smoke.includes('/api/chronicles/runs'));
 assert.ok(smoke.includes('.Config.User'));
});
