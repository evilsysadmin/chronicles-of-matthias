// Public staging: real user journey, real Chronicles API and durable checkpoints.
// The ONLY simulated requests are Chess Studio's SSO handshake; no shared IdP writes.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

const web = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const idp = 'https://api-staging.chess-studio.shadowops.dpdns.org/api/**';
const expectedSha = process.env.CHRONICLES_SOURCE_SHA;
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
if (!/^[a-f0-9]{40}$/.test(expectedSha || '') || !invite) {
  throw new Error('Missing admitted Chronicles SHA or staging invite');
}

const manifest = await fetch(web + '/release.json?ts=' + Date.now(), { cache: 'no-store' });
assert.equal(manifest.status, 200, 'Public release.json unavailable');
assert.equal((await manifest.json()).build, expectedSha, 'Public release SHA mismatch');

const username = 'browser-journey-' + randomBytes(5).toString('hex');
const password = randomBytes(21).toString('base64url');
let token = null;
let browser = null;
const savedRuns = new Set();
const eventLog = [];

function isApi(response, verb, re, expected = 200) {
  return response.request().method() === verb
    && re.test(new URL(response.url()).pathname)
    && response.url().startsWith(api) && response.status() === expected;
}

async function browserSession(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(idp, async route => {
    const req = route.request();
    const uri = new URL(req.url()).pathname;
    const headers = {
      'access-control-allow-origin': web,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
    } else if (uri === '/api/identity/token') {
      await route.fulfill({ status: 401, headers, contentType: 'application/json',
        body: '{"detail":"No previous SSO cookie"}' });
    } else if (uri === '/api/auth/login') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json',
        body: '{"token":"browser-journey-idp-stub"}' });
    } else if (uri === '/api/identity/session') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json',
        body: JSON.stringify({ username, token, expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
    } else {
      throw new Error('Unexpected IdP endpoint ' + uri);
    }
  });
  await page.goto(web, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('chess-study-auth-token')),
    null, { timeout: 30_000 });
  await page.locator('[data-chronicles-save-menu="home"]').waitFor({ timeout: 30_000 });
  assert.deepEqual(errors, [], 'Browser errors on login');
  return { page, context, errors };
}

async function closeFirstSteps(page) {
  const overlay = page.locator('[data-chronicles-first-steps]');
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.getByRole('button', { name: 'Entendido' }).click();
  }
}

async function saveCheckpoint(page, label) {
  const menuButton = page.getByLabel('Abrir menú de Chronicles');
  await menuButton.click();
  // Stable interaction hook: visible copy may include the shortcut hint.
  const saveButton = page.locator('button[data-chronicles-menu-save]');
  await saveButton.waitFor({ state: 'visible', timeout: 10_000 });
  const request = page.waitForResponse(response =>
    response.request().method() === 'PUT'
    && /\/api\/chronicles\/runs\/[^/]+\/checkpoint$/.test(new URL(response.url()).pathname)
    && response.url().startsWith(api), { timeout: 25_000 });
  await saveButton.click();
  const response = await request;
  assert.equal(response.status(), 200,
    `Checkpoint save failed (HTTP ${response.status()}): ${(await response.text()).slice(0, 300)}`);
  const payload = response.request().postDataJSON();
  assert.ok(payload?.worldFlags && typeof payload.worldFlags === 'object',
    'The actual checkpoint must carry durable world flags');
  assert.ok(Number.isInteger(payload.worldFlags['__chrRuntime.direction']),
    'Checkpoint lacks persistent facing');
  await page.getByText('Partida guardada correctamente.').waitFor({ timeout: 15_000 });
  eventLog.push(label + ':checkpoint:200');
  return payload.worldFlags;
}

function runtimeLocation(flags) {
  return ['x', 'y', 'direction'].map(key => flags['__chrRuntime.' + key]);
}

const registration = await fetch(api + '/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password, email: username + '@example.com', inviteCode: invite }),
});
assert.equal(registration.status, 201, 'Staging user registration failed');
token = (await registration.json()).token;
assert.ok(token, 'New staging user has no cleanup token');

try {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // Desktop: visibly create a custom party; never skip the actual character composer.
  const desktop = await browserSession({ width: 1280, height: 800 });
  try {
    const { page } = desktop;
    await page.getByRole('button', { name: /Nueva expedición/ }).click();
    await page.locator('[data-chronicles-character-setup="choice"]').waitFor();
    await page.getByRole('button', { name: 'Crear mis personajes' }).click();
    await page.locator('[data-chronicles-character-setup="editor"]').waitFor();
    const alias = 'Matthias E2E';
    await page.locator('input[aria-label^="Nombre del héroe 1:"]').fill(alias);
    assert.equal(await page.locator('input[aria-label^="Nombre del héroe 1:"]').inputValue(), alias);
    const creation = page.waitForResponse(response =>
      isApi(response, 'POST', /\/api\/chronicles\/runs$/, 201), { timeout: 30_000 });
    await page.getByRole('button', { name: 'Confirmar compañía' }).click();
    const created = await creation;
    const run = await created.json();
    assert.ok(run.runId, 'Run creation did not return a server id');
    savedRuns.add(run.runId);
    await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });
    await closeFirstSteps(page);
    // In Swordhaven (9,7 facing N), ↑ advances onto an open tile.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    const flags = await saveCheckpoint(page, 'desktop');
    assert.ok(flags['__chrRuntime.turns'] >= 1, 'Movement was not applied by the real reducer');
    assert.equal(flags['__chrRuntime.direction'], 1, 'Right rotation was not persisted');
    assert.ok(savedRuns.has(run.runId));
    await page.screenshot({ path: 'chronicles-journey-desktop.png' });
    console.log('CHRONICLES_PUBLIC_JOURNEY_DESKTOP_OK');
    desktop.flags = flags;
    desktop.runId = run.runId;
  } finally {
    await desktop.context.close();
  }

  // Fresh device (no local storage): recover same server expedition on mobile.
  const mobile = await browserSession({ width: 390, height: 844 });
  try {
    const { page } = mobile;
    const resumed = page.waitForResponse(response =>
      isApi(response, 'GET', /\/api\/chronicles\/runs\/[^/]+\/bootstrap$/, 200),
      { timeout: 30_000 });
    await page.getByRole('button', { name: /Continuar expedición/ }).click();
    const body = await (await resumed).json();
    assert.equal(body.runId, desktop.runId, 'Fresh mobile session did not restore the same run');
    assert.deepEqual(runtimeLocation(body.worldFlags), runtimeLocation(desktop.flags),
      'Mobile bootstrap lost desktop movement or facing');
    await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });
    await closeFirstSteps(page);
    // Use the touch controls, not a keyboard shortcut, on mobile.
    await page.locator('[data-chronicles-touch-action="turn-left"]').click();
    const mobileFlags = await saveCheckpoint(page, 'mobile');
    assert.notEqual(mobileFlags['__chrRuntime.direction'], desktop.flags['__chrRuntime.direction'],
      'Mobile tap did not reach the reducer');
    await page.screenshot({ path: 'chronicles-journey-mobile.png' });
    console.log('CHRONICLES_PUBLIC_JOURNEY_MOBILE_OK');
    mobile.flags = mobileFlags;
  } finally {
    await mobile.context.close();
  }

  // Another fresh browser: prove the MOBILE checkpoint was durable too.
  const restored = await browserSession({ width: 1280, height: 800 });
  try {
    const { page } = restored;
    const responsePromise = page.waitForResponse(response =>
      isApi(response, 'GET', /\/api\/chronicles\/runs\/[^/]+\/bootstrap$/, 200),
      { timeout: 30_000 });
    await page.getByRole('button', { name: /Continuar expedición/ }).click();
    const saved = await (await responsePromise).json();
    assert.equal(saved.runId, desktop.runId);
    assert.deepEqual(runtimeLocation(saved.worldFlags), runtimeLocation(mobile.flags),
      'Reload did not preserve mobile checkpoint');
    await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });
    assert.deepEqual(restored.errors, []);
    console.log('CHRONICLES_PUBLIC_JOURNEY_RESTORE_OK');
  } finally {
    await restored.context.close();
  }
  console.log('CHRONICLES_PUBLIC_JOURNEY_OK ' + eventLog.join(','));
} finally {
  await browser?.close();
  if (token) {
    const removed = await fetch(api + '/auth/delete-account', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    assert.ok(removed.ok, 'Ephemeral Chronicles account cleanup failed: ' + removed.status);
  }
}
