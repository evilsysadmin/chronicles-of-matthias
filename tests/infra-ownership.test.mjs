import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Cloudflare ownership contract avoids touching Chess Studio resources', () => {
  const output = execFileSync(process.execPath, ['scripts/infra-ownership-check.mjs'], { encoding: 'utf8' });
  assert.match(output, /ownership contract OK/);
});
