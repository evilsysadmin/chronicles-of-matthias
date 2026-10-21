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
