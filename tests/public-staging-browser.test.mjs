import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('frontend/smoke/public-staging.mjs', 'utf8');
test('public browser smoke uses real dedicated staging origins and validates published SHA', () => {
  for (const marker of [
    'https://staging.chronicles.shadowops.dpdns.org',
    'https://chronicles-api-staging.shadowops.dpdns.org/api',
    'CHRONICLES_SOURCE_SHA', "assert.equal(published.build, expectedSha",
    'CHRONICLES_STAGING_INVITE_CODE', "getByRole('button', { name: 'Entrar'",
    'width: 390', 'width: 1280',
  ]) assert.ok(source.includes(marker), marker);
});
test('throwaway user always deleted; no reload during a game', () => {
  assert.ok(source.includes('finally {'));
  assert.ok(source.includes("'/auth/delete-account'"));
  assert.ok(source.includes("name: 'Actualizar'"));
  assert.ok(source.includes("name: 'Después'"));
  assert.ok(source.includes('CHRONICLES_PUBLIC_BROWSER_OK'));
});
