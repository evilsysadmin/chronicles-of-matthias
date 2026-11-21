import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { isGoOnlyPRFileSet } from '../scripts/classify-browser-ci.mjs';

const file = (filename, status = 'modified') => ({ filename, status });
const go = [file('api/internal/gamesapi/account.go'), file('api/cmd/chronicles-api/main.go')];

test('accepts ordinary Go-only API changes', () => {
  assert.equal(isGoOnlyPRFileSet(go), true);
  assert.equal(isGoOnlyPRFileSet([file('api/internal/chronicles/route_test.go', 'added')]), true);
  assert.equal(isGoOnlyPRFileSet([file('api/internal/pawnslug/old.go', 'removed')]), true);
});

test('fails conservatively on frontend, workflows, dependencies and unknown paths', () => {
  for (const path of [
    'frontend/src/chroniclesOfMatthias.js',
    '.github/workflows/react-frontend.yml',
    'api/go.mod',
    'api/Dockerfile',
    'api/internal/chronicles/content/maps/terra-f1.json',
    'scripts/release.mjs',
    'README.md',
    'api/internal/../frontend/src/main.go',
    'api/internal/chronicles/odd file.go',
    'api/internal/chronicles/bad.go\napi/internal/chronicles/other.go',
  ]) {
    assert.equal(isGoOnlyPRFileSet([...go, file(path)]), false, path);
  }
  assert.equal(isGoOnlyPRFileSet([]), false);
  assert.equal(isGoOnlyPRFileSet(null), false);
  assert.equal(isGoOnlyPRFileSet(Array(1001).fill(go[0])), false);
});

test('fails conservatively on renames, malformed records and unknown statuses', () => {
  assert.equal(isGoOnlyPRFileSet([{ ...go[0], status: 'renamed', previous_filename: 'frontend/src/x.js' }]), false);
  assert.equal(isGoOnlyPRFileSet([{ ...go[0], previous_filename: 'frontend/src/x.js' }]), false);
  assert.equal(isGoOnlyPRFileSet([file('api/internal/chronicles/world.go', 'copied')]), false);
  assert.equal(isGoOnlyPRFileSet([{}]), false);
  assert.equal(isGoOnlyPRFileSet(['api/internal/chronicles/world.go']), false);
});

test('CLI handles paginated NDJSON and bad data without passing', () => {
  const input = go.map((f) => JSON.stringify(f)).join('\n') + '\n';
  const run = (value) => spawnSync(process.execPath, ['scripts/classify-browser-ci.mjs'], {
    encoding: 'utf8', input: value,
  });
  assert.equal(run(input).status, 0);
  assert.equal(run(input + JSON.stringify(file('frontend/src/App.jsx')) + '\n').status, 1);
  assert.equal(run('{"filename":\n').status, 1);
  assert.equal(run('').status, 1);
});
