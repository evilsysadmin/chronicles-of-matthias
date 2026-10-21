import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../api/Dockerfile', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');

test('immutable API image publishes its source SHA through /api/release', () => {
  assert.match(dockerfile, /FROM scratch\s+[^]*?ARG CHRONICLES_SOURCE_SHA/);
  assert.match(dockerfile, /ENV GIT_COMMIT_SHA=\$\{CHRONICLES_SOURCE_SHA\}/);
  assert.match(workflow, /build-args:\s*\|\s*CHRONICLES_SOURCE_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /org\.opencontainers\.image\.revision=\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /ghcr\.io|env\.IMAGE/);
});

test('Node 24 Docker Buildx action preserves immutable GHCR push and provenance wiring', () => {
  const publish = workflow.slice(workflow.indexOf('\n  publish:\n'));
  assert.match(publish, /uses: docker\/build-push-action@v7/);
  assert.doesNotMatch(publish, /docker\/build-push-action@v6/);
  assert.match(publish, /id: admission/);
  assert.match(publish, /needs: verify/);
  assert.match(publish, /id: push\s*\n\s*uses: docker\/build-push-action@v7/);
  assert.match(publish, /platforms: linux\/arm64,linux\/amd64/);
  assert.match(publish, /push: true/);
  assert.match(publish, /tags: \$\{\{ env\.IMAGE \}\}:staging-\$\{\{ github\.sha \}\}/);
  assert.match(publish, /subject-digest: \$\{\{ steps\.push\.outputs\.digest \}\}/);
  assert.match(publish, /push-to-registry: true/);
  assert.match(publish, /if: steps\.admission\.outputs\.publish == 'true'[\s\S]+?uses: docker\/build-push-action@v7/);
});
