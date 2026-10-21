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

test('only ShadowOps IdP token handoff is stubbed; real Chronicles API is untouched', () => {
  assert.ok(source.includes('api-staging.chess-studio.shadowops.dpdns.org/api/**'));
  assert.ok(source.includes("url.pathname === '/api/identity/session'"));
  assert.ok(source.includes("url.pathname === '/api/identity/token'"));
  assert.ok(source.includes("url.pathname === '/api/auth/login'"));
  assert.ok(source.includes("await fetch(api + '/auth/register'"));
  assert.ok(!source.includes("page.route('https://chronicles-api-staging"));
});

test('public smoke enters a real party-choice screen and accepts the two legitimate CTAs', () => {
  for (const marker of [
    '[data-chronicles-character-setup="choice"]',
    'Empezar con este grupo', 'Continuar con mi compañía',
    'CHRONICLES_PUBLIC_SETUP_UNAVAILABLE',
    'chronicles-public-setup-failed-',
  ]) assert.ok(source.includes(marker), marker);
  assert.ok(source.includes("throw error;"), 'missing setup must still fail the release gate');
});

test('each viewport uses an independent real account and always cleans it up', () => {
  const loop = source.indexOf('for (const viewport of [');
  const register = source.indexOf("const registration = await fetch(api + '/auth/register'");
  const cleanup = source.indexOf("const removed = await fetch(api + '/auth/delete-account'");
  const loopEnd = source.indexOf('  }\n} finally {\n  await browser?.close();');
  assert.ok(loop > 0 && register > loop && cleanup > register && cleanup < loopEnd,
    'register and delete-account must belong to each viewport, not the whole browser run');
  assert.ok(source.includes('public-staging-journey.mjs'), 'cross-device tests stay independent');
  assert.ok(source.includes('await ctx?.close()'));
});

test('first-steps public smoke selects only the visible guide and catches duplicate visible onboarding', () => {
  assert.ok(source.includes("world.locator('[data-chronicles-first-steps]:visible')"));
  assert.ok(source.includes('const visibleFirstSteps = await firstSteps.count();'));
  assert.ok(source.includes('if (visibleFirstSteps > 1)'));
  assert.ok(source.includes('chronicles-public-first-steps-duplicate-'));
  assert.ok(source.includes('if (visibleFirstSteps === 1)'));
  assert.ok(source.includes("firstSteps.getByRole('button', { name: 'Entendido' }).click()"));
  assert.ok(!source.includes("world.locator('[data-chronicles-first-steps]');"),
    'unscoped locator makes isVisible strict on retained hidden guides');
});
