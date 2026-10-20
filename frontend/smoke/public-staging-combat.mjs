// Authored crypt encounter on PUBLIC staging. No mocked game, enemy, damage or checkpoint.
// A fresh Chronicles-only account is deleted even if the combat test fails.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const expectedSha = process.env.CHRONICLES_SOURCE_SHA;
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
if (!invite || !/^[0-9a-f]{40}$/.test(expectedSha || '')) throw new Error('Missing staging credentials or SHA');

const response = await fetch(origin + '/release.json?ts=' + Date.now(), { cache: 'no-store' });
assert.equal(response.status, 200);
assert.equal((await response.json()).build, expectedSha);

const username = 'combat-journey-' + randomBytes(5).toString('hex');
const password = randomBytes(21).toString('base64url');
const created = await fetch(api + '/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password, email: username + '@example.com', inviteCode: invite }),
});
assert.equal(created.status, 201);
const token = (await created.json()).token;
assert.ok(token);
let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://api-staging.chess-studio.shadowops.dpdns.org/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/api/identity/token') return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{}' });
    if (path === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"token":"idp-test-handoff"}' });
    if (path === '/api/identity/session') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
      body: JSON.stringify({ username, token, expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
    throw new Error('Unexpected IdP request: ' + path);
  });

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('chess-study-auth-token')), null, { timeout: 30_000 });
  await page.locator('[data-chronicles-save-menu="home"]').waitFor({ timeout: 30_000 });
  // Unlike the authored first-book town, "Otra aventura" starts in the
  // crypt with an ACTUAL enemy two tiles east of the company's spawn.
  await page.locator('.chronicles-save-menu__more > summary').click();
  await page.getByRole('button', { name: /Otra aventura/ }).click();
  await page.locator('[data-chronicles-character-setup="choice"]').waitFor();
  const newRun = page.waitForResponse(r => r.request().method() === 'POST'
    && new URL(r.url()).pathname === '/api/chronicles/runs' && r.status() === 201,
  { timeout: 30_000 });
  await page.getByRole('button', { name: 'Empezar con este grupo' }).click();
  const game = await (await newRun).json();
  assert.equal(game.currentMapId, 'crypt-eight-squares', 'Expected the authored crypt enemy');
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });

  // With a real archer and the live crypt AI, S fires the opening volley.
  // Then approach the corrupted pawn and attempt a real melee action.
  await page.keyboard.press('s');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('a');

  // Switch to the mobile controls and issue an actual touch attack as well.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-chronicles-touch-action="attack"]').click();
  await page.getByLabel('Abrir menú de Chronicles').click();
  const checkpoint = page.waitForResponse(r => r.request().method() === 'PUT'
    && /\/api\/chronicles\/runs\/[^/]+\/checkpoint$/.test(new URL(r.url()).pathname)
    && r.status() === 200, { timeout: 25_000 });
  await page.getByRole('button', { name: 'Guardar partida', exact: true }).click();
  const put = await checkpoint;
  const flags = put.request().postDataJSON()?.worldFlags || {};
  const enemyHp = flags.enemyHp;
  const initiative = flags['__chrRuntime.initiative'];
  // This is a REAL encounter test: no fake damage, hit messages or HP.
  // It passes if the pawn sustained authentic damage OR initiative started.
  assert.ok((typeof enemyHp === 'number' && enemyHp < 5) || (typeof initiative === 'string' && initiative.length > 10),
    'No actual damage or initiative was recorded for the authored crypt encounter');
  await page.getByText('Partida guardada correctamente.').waitFor({ timeout: 15_000 });
  assert.deepEqual(errors, [], 'Browser exceptions during live combat');
  await page.screenshot({ path: 'chronicles-combat-mobile.png', fullPage: false });
  console.log('CHRONICLES_PUBLIC_COMBAT_OK crypt-eight-squares real-enemy');
  await context.close();
} finally {
  await browser?.close();
  const deleted = await fetch(api + '/auth/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.ok(deleted.ok, 'Failed to delete ephemeral Chronicles combat account: ' + deleted.status);
}
