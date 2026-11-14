// Real public staging regression for an authored rear ranged threat in Book One.
// Ranged enemies attack during EXPLORATION in MM3. They do not automatically
// force initiative, and the player may turn only while outside initiative.
// This supplements (never replaces) the legacy crypt initiative combat smoke.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import {
  REAR_SHOOTER_MAP_ID, REAR_SHOOTER_ENEMY_ID, REAR_SHOOTER_START,
  REAR_SHOOTER_VANTAGE, REAR_SHOOTER_ROUTE,
} from './public-rear-shooter-route.mjs';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const expectedSha = process.env.CHRONICLES_SOURCE_SHA;
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
if (!invite || !/^[a-f0-9]{40}$/.test(expectedSha || '')) {
  throw new Error('Rear shooter smoke requires admitted staging SHA and invitation');
}
const published = await fetch(origin + '/release.json?rear=' + Date.now(), { cache: 'no-store' });
assert.equal(published.status, 200, 'Published Swordhaven client not available');
assert.equal((await published.json()).build, expectedSha, 'Rear smoke must test the exact staged SHA');

const username = 'rear-shooter-' + randomBytes(6).toString('hex');
const password = randomBytes(21).toString('base64url');
const registration = await fetch(api + '/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password, email: username + '@example.com', inviteCode: invite }),
});
assert.equal(registration.status, 201, 'Could not create ephemeral Chronicles rear smoke user');
const token = (await registration.json()).token;
assert.ok(token, 'Registration has no token');
let browser;
let page;
let finished = false;
const errors = [];

function observe(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-chronicles="true"]');
    const n = name => {
      const value = root?.getAttribute(name);
      return value === null || value === undefined ? null : Number(value);
    };
    const bearing = root?.querySelector('[data-chronicles-minimap-facing]');
    return {
      mapId: root?.getAttribute('data-chronicles-map-id') || null,
      x: n('data-chronicles-party-x'),
      y: n('data-chronicles-party-y'),
      facing: bearing ? Number(bearing.getAttribute('data-chronicles-minimap-facing')) : null,
      turns: n('data-chronicles-turns'),
      partyHp: n('data-party-hp-total'),
      phase: root?.getAttribute('data-chronicles-phase'),
      initiative: Boolean(document.querySelector('[data-chronicles-initiative="visible"]')),
    };
  });
}

async function commitKey(action, expected) {
  const before = await observe(page);
  assert.equal(before.phase, 'explore', 'Rear ranged test unexpectedly entered initiative');
  assert.equal(before.initiative, false, 'No MM3 rotation is legal in initiative');
  await page.keyboard.press(action);
  await page.waitForFunction(target => {
    const root = document.querySelector('[data-chronicles="true"]');
    return root?.getAttribute('data-chronicles-phase') === 'explore'
      && Number(root?.getAttribute('data-chronicles-turns')) > target.turns
      && Number(root?.getAttribute('data-chronicles-party-x')) === target.x
      && Number(root?.getAttribute('data-chronicles-party-y')) === target.y
      && Number(root?.querySelector('[data-chronicles-minimap-facing]')?.getAttribute(
        'data-chronicles-minimap-facing')) === target.direction;
  }, { ...expected, turns: before.turns }, { timeout: 12000 });
  const after = await observe(page);
  assert.equal(after.turns, before.turns + 1, 'A movement/turn must spend exactly one exploration action');
  assert.equal(after.x, expected.x);
  assert.equal(after.y, expected.y);
  assert.equal(after.facing, expected.direction);
  assert.equal(after.phase, 'explore');
  assert.equal(after.initiative, false, 'Distant crossbow fire must not force initiative');
  assert.ok(after.partyHp > 0, 'Rear shooter expedition defeated before response');
  return after;
}

try {
  const creation = await fetch(api + '/chronicles/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ mapId: REAR_SHOOTER_MAP_ID }),
  });
  assert.equal(creation.status, 201, 'Could not create a real Book One Swordhaven expedition');
  const run = await creation.json();
  assert.equal(run.currentMapId, REAR_SHOOTER_MAP_ID);
  assert.ok(run.runId, 'Official run missing identifier');
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  // ONLY the shared Chess Studio identity handoff is stubbed; the Chronicles
  // registration, campaign, combat, checkpoint and restore APIs stay real.
  await page.route('https://api-staging.chess-studio.shadowops.dpdns.org/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const cors = {
      'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    if (path === '/api/identity/token') {
      return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{}' });
    }
    if (path === '/api/auth/login') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"token":"rear-idp-handoff"}' });
    }
    if (path === '/api/identity/session') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ username, token, expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
    }
    throw new Error('Unexpected shared identity request ' + path);
  });

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('chess-study-auth-token')),
    null, { timeout: 30000 });
  await page.locator('[data-chronicles-save-menu="home"]').waitFor({ timeout: 30000 });
  await page.locator('[data-chronicles-primary-action="continue"] button.is-primary').click();
  const world = page.locator('[data-chronicles="true"][data-chronicles-map-id="' + REAR_SHOOTER_MAP_ID + '"]');
  await world.waitFor({ state: 'visible', timeout: 30000 });
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30000 });
  const firstSteps = world.locator('[data-chronicles-first-steps]:visible');
  if (await firstSteps.count()) {
    await firstSteps.getByRole('button', { name: 'Entendido' }).click();
  }

  const start = await observe(page);
  assert.deepEqual({ x: start.x, y: start.y, direction: start.facing }, REAR_SHOOTER_START,
    'Actual initial Swordhaven coordinates or heading changed');
  assert.ok(start.partyHp > 0, 'Fresh Swordhaven party has no health');
  for (const step of REAR_SHOOTER_ROUTE) await commitKey(step.action, step);
  const behind = await observe(page);
  assert.deepEqual({ x: behind.x, y: behind.y, direction: behind.facing }, REAR_SHOOTER_VANTAGE);
  console.log('CHRONICLES_PUBLIC_REAR_VANTAGE_OK ' + JSON.stringify({
    map: behind.mapId, x: behind.x, y: behind.y, facing: behind.facing,
    actions: REAR_SHOOTER_ROUTE.length, partyHp: behind.partyHp, enemy: REAR_SHOOTER_ENEMY_ID,
  }));

  // Shooter is two valid map tiles behind. A real backward key must close to
  // one tile with NO camera rotation or initiative. No hidden state, damage
  // injection, forced encounter or scripted rescue is permitted.
  const nearer = await commitKey('ArrowDown', { x: 15, y: 14, direction: 0 });
  assert.equal(nearer.facing, 0, 'Approaching a rear shooter must retain heading');

  // Ranged fire is EXPLORATION by design; turning is legitimate here, not
  // during initiative. Exercise a real facing response and opening volley.
  await commitKey('ArrowRight', { x: 15, y: 14, direction: 1 });
  const facingShooter = await commitKey('ArrowRight', { x: 15, y: 14, direction: 2 });
  const shot = world.locator('[data-chronicles-touch-action="attack"]');
  assert.equal(await shot.getAttribute('data-chronicles-touch-attack-mode'), 'missile',
    'Starting company cannot answer the ranged threat with its own real missile weapon');
  assert.equal(await shot.isEnabled(), true, 'Opening volley became disabled outside initiative');
  await page.keyboard.press('s');
  await page.waitForFunction(previous => Number(
    document.querySelector('[data-chronicles="true"]')?.getAttribute('data-chronicles-turns')) > previous,
  facingShooter.turns, { timeout: 12000 });
  const fired = await observe(page);
  assert.equal(fired.turns, facingShooter.turns + 1, 'One S volley spent duplicate/no action');
  assert.equal(fired.phase, 'explore', 'Ranged exploration incorrectly entered initiative');
  assert.equal(fired.facing, 2);
  assert.ok(fired.partyHp > 0, 'Party died while replying to a rear crossbowman');
  console.log('CHRONICLES_PUBLIC_REAR_RESPONSE_OK ' + JSON.stringify({
    approach: 'backward', combatRules: 'ranged-exploration',
    volley: true, x: fired.x, y: fired.y, heading: fired.facing,
    hpBefore: start.partyHp, hpAfter: fired.partyHp,
  }));

  // Public menu + official PUT + real server GET + F5, never localStorage
  // seeding or an invented snapshot. A ranged incident must be recoverable.
  await page.getByLabel('Abrir menú de Chronicles').click();
  const save = page.locator('[data-chronicles-menu-save]');
  await save.waitFor({ state: 'visible', timeout: 12000 });
  assert.equal(await save.isEnabled(), true, 'Saving outside initiative should be possible');
  const saving = page.waitForResponse(r => r.url().startsWith(api)
    && new URL(r.url()).pathname === '/api/chronicles/runs/' + run.runId + '/checkpoint'
    && r.request().method() === 'PUT', { timeout: 25000 });
  await save.click();
  assert.equal((await saving).status(), 200, 'Real server checkpoint failed');
  const checkpoint = await fetch(api + '/chronicles/runs/' + encodeURIComponent(run.runId) + '/bootstrap', {
    headers: { Authorization: 'Bearer ' + token },
  });
  assert.equal(checkpoint.status, 200, 'Backend lost Swordhaven rear shooter checkpoint');
  const saved = await checkpoint.json();
  assert.equal(saved.runId, run.runId);
  assert.equal(saved.currentMapId, REAR_SHOOTER_MAP_ID);
  const flags = saved.worldFlags || {};
  for (const [key, expected] of Object.entries({
    x: fired.x, y: fired.y, direction: fired.facing, turns: fired.turns,
  })) {
    assert.equal(Number(flags['__chrRuntime.' + key]), expected,
      'Server checkpoint lost player field ' + key);
  }

  const reload = page.waitForResponse(r => r.url().startsWith(api)
    && new URL(r.url()).pathname === '/api/chronicles/runs/' + run.runId + '/bootstrap'
    && r.request().method() === 'GET' && r.status() === 200, { timeout: 30000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    document.querySelector('[data-chronicles-save-menu="home"]')
      || document.querySelector('[data-chronicles-map-id]')), null, { timeout: 30000 });
  if (await page.locator('[data-chronicles-save-menu="home"]').isVisible()) {
    await page.getByRole('button', { name: /Continuar expedición/ }).click();
  }
  const restored = await (await reload).json();
  assert.equal(restored.runId, run.runId, 'F5 resumed a different expedition');
  assert.equal(restored.currentMapId, saved.currentMapId);
  for (const key of ['x', 'y', 'direction', 'turns', 'initiative']) {
    assert.deepEqual(restored.worldFlags?.['__chrRuntime.' + key], flags['__chrRuntime.' + key],
      'F5 lost durable rear encounter field ' + key);
  }
  await world.waitFor({ state: 'visible', timeout: 30000 });
  const afterF5 = await observe(page);
  assert.equal(afterF5.x, fired.x);
  assert.equal(afterF5.y, fired.y);
  assert.equal(afterF5.facing, fired.facing);
  assert.equal(afterF5.turns, fired.turns);
  assert.equal(afterF5.partyHp, fired.partyHp, 'F5 lost real battle damage or health');
  assert.deepEqual(errors, [], 'Browser exceptions in live Swordhaven rear shooter');
  console.log('CHRONICLES_PUBLIC_REAR_RESTORE_OK same-run');
  console.log('CHRONICLES_PUBLIC_REAR_SHOOTER_OK sha=' + expectedSha);
  await page.screenshot({ path: 'chronicles-public-rear-shooter.png', fullPage: false });
  finished = true;
} finally {
  if (!finished) await page?.screenshot({
    path: 'chronicles-public-rear-shooter-failure.png', fullPage: false, timeout: 5000,
  }).catch(() => {});
  await browser?.close();
  const deleted = await fetch(api + '/auth/delete-account', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.ok(deleted.ok, 'Rear shooter ephemeral account not revoked: ' + deleted.status);
}
