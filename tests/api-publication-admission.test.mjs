import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const publish = workflow.slice(workflow.indexOf('\n  publish:\n'));
const lines = publish.split('\n');
const preflight = lines.findIndex((line) => line === '        run: |');
const nextStep = lines.findIndex((line, index) => index > preflight && line.startsWith('      - uses: actions/checkout@'));
assert.ok(preflight > 0 && nextStep > preflight, 'the publication preflight must be a shell step');
const script = lines.slice(preflight + 1, nextStep)
  .map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n');

function runWithMain(currentSha, shouldFail = false) {
  const dir = mkdtempSync(join(tmpdir(), 'chronicles-api-publish-'));
  try {
    const gh = join(dir, 'gh');
    writeFileSync(gh, '#!/bin/sh\nif [ "$FAKE_GH_FAILURE" = 1 ]; then exit 1; fi\nprintf "%s\\n" "$FAKE_MAIN_SHA"\n');
    chmodSync(gh, 0o755);
    const output = join(dir, 'output');
    const summary = join(dir, 'summary');
    writeFileSync(output, '');
    writeFileSync(summary, '');
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: dir + delimiter + process.env.PATH,
        FAKE_MAIN_SHA: currentSha,
        FAKE_GH_FAILURE: shouldFail ? '1' : '0',
        GITHUB_SHA: 'a'.repeat(40),
        GITHUB_REPOSITORY: 'evilsysadmin/chronicles-of-matthias',
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    return {
      status: result.status,
      stderr: result.stderr,
      output: readFileSync(output, 'utf8'),
      summary: readFileSync(summary, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('current main SHA permits immutable image publication', () => {
  const result = runWithMain('a'.repeat(40));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^publish=true$/m);
});

test('superseded SHA skips all Docker actions without failing an old completed E2E', () => {
  const result = runWithMain('b'.repeat(40));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^publish=false$/m);
  assert.match(result.summary, /no longer main/);
});

test('unavailable GitHub API never authorizes publication', () => {
  const result = runWithMain('a'.repeat(40), true);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.output, /publish=true/);
});

test('invalid current main SHA cannot authorize publication', () => {
  const result = runWithMain('unexpected');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.output, /publish=true/);
});
