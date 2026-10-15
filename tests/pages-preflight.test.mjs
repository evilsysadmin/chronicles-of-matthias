import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pagesTarget, assertDeployableDirectory } from '../scripts/pages-preflight.mjs';

test('production and staging Pages projects are isolated', () => {
  assert.notEqual(pagesTarget('production').project, pagesTarget('staging').project);
  assert.equal(pagesTarget('production').hostname, 'chronicles.shadowops.dpdns.org');
  assert.throws(() => pagesTarget('unknown'));
});

test('preflight validates the standalone artifact without Cloudflare credentials', () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  assert.equal(assertDeployableDirectory(), true);
});
