import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gotoSmokeFixture } from '../frontend/smoke/fixture-navigation.mjs';

const fixture = 'http://localhost:4174/smoke/first-hour-contact.html?view=guides';

test('one Chromium ERR_ABORTED gets exactly one repeat of the same fixture URL', async () => {
  const args = [];
  const ok = { status: 200 };
  const page = {
    isClosed: () => false,
    goto: async (...values) => {
      args.push(values);
      if (args.length === 1) throw new Error('page.goto: net::ERR_ABORTED at ' + fixture);
      return ok;
    },
  };
  assert.equal(await gotoSmokeFixture(page, fixture), ok);
  assert.deepEqual(args, [[fixture, { waitUntil: 'domcontentloaded' }], [fixture, { waitUntil: 'domcontentloaded' }]]);
});

test('non-navigation errors are not retried or hidden', async () => {
  let calls = 0;
  const error = new Error('page.goto: net::ERR_CONNECTION_REFUSED');
  const page = {
    isClosed: () => false,
    goto: async () => { calls += 1; throw error; },
  };
  await assert.rejects(gotoSmokeFixture(page, fixture), (received) => received === error);
  assert.equal(calls, 1);
});

test('second aborted navigation still fails the smoke', async () => {
  let calls = 0;
  const page = {
    isClosed: () => false,
    goto: async () => { calls += 1; throw new Error('net::ERR_ABORTED'); },
  };
  await assert.rejects(gotoSmokeFixture(page, fixture), /net::ERR_ABORTED/);
  assert.equal(calls, 2);
});

test('closed page abort is never retried', async () => {
  let calls = 0;
  const page = {
    isClosed: () => true,
    goto: async () => { calls += 1; throw new Error('net::ERR_ABORTED'); },
  };
  await assert.rejects(gotoSmokeFixture(page, fixture), /net::ERR_ABORTED/);
  assert.equal(calls, 1);
});
