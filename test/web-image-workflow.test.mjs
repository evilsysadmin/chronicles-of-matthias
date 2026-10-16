import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/web-publish.yml','utf8');
const dockerfile=readFileSync('web/Dockerfile','utf8');

test('web image publishes only from trusted main SHA, not pull requests',()=>{
 for(const expected of [
  "github.event_name == 'push'",
  "github.ref == 'refs/heads/main'",
  "github.repository == 'evilsysadmin/chronicles-of-matthias'",
  'TAG: staging-${{ github.sha }}',
  'ghcr.io/evilsysadmin/chronicles-web',
  'needs: web-image-policy',
 ]) assert.ok(workflow.includes(expected),expected);
 assert.doesNotMatch(workflow, /:(?:latest|prod|production)\b/);
 assert.doesNotMatch(workflow, /docker compose up|kubectl apply|cloudflare deploy|wrangler pages deploy/);
});

test('both architectures are checked, ARM64 runs before publishing',()=>{
 for(const expected of [
  'docker/setup-qemu-action@v3',
  'docker/setup-buildx-action@v3',
  'linux/arm64 --load',
  '--platform linux/amd64,linux/arm64',
  'docker buildx imagetools inspect --raw',
  '.platform.architecture == "amd64"',
  '.platform.architecture == "arm64"',
  '--tmpfs /tmp:rw,nosuid,nodev,size=16m',
  "grep -q 'todavía no es el juego'",
 ]) assert.ok(workflow.includes(expected),expected);
 assert.ok(workflow.indexOf('Test ARM64 container before publishing') <
  workflow.indexOf('Publish SHA-pinned multiarch staging web manifest'));
 assert.ok(dockerfile.includes('nginxinc/nginx-unprivileged:'));
 assert.ok(dockerfile.includes('EXPOSE 8080'));
});

test('image is attested by a fixed source workflow and immutable digest',()=>{
 for(const expected of [
  'packages: write',
  'id-token: write',
  'attestations: write',
  'actions/attest@v4',
  'push-to-registry: true',
  'subject-name: ghcr.io/evilsysadmin/chronicles-web',
  'subject-digest: ${{ steps.publish.outputs.digest }}',
  'org.opencontainers.image.revision',
  '--metadata-file',
 ]) assert.ok(workflow.includes(expected),expected);
 assert.match(workflow, /sha256:\[a-f0-9\]\{64\}/);
});
