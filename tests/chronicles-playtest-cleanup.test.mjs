import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPlaytestAccountRevoked } from '../frontend/smoke/playtest-cleanup.mjs';

test('deleted playtest identity must reject the original credentials', async () => {
  let request;
  await assertPlaytestAccountRevoked(async (url, options) => {
    request = { url, options };
    return { status: 401 };
  }, 'https://staging.example/api', 'playtest-user', 'secret');
  assert.equal(request.url, 'https://staging.example/api/auth/login');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    username: 'playtest-user', password: 'secret',
  });
});

test('revocation probe fails closed on success, throttling and server errors', async () => {
  for (const status of [200, 403, 429, 500]) {
    await assert.rejects(
      assertPlaytestAccountRevoked(async () => ({ status }), '/api', 'u', 'p'),
      new RegExp('BOT_ACCOUNT_REVOCATION_FAILED HTTP ' + status),
    );
  }
});

test('revocation probe propagates network errors', async () => {
  await assert.rejects(
    assertPlaytestAccountRevoked(async () => { throw new Error('network unavailable'); }, '/api', 'u', 'p'),
    /network unavailable/,
  );
});
