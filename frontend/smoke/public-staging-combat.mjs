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
let page;
let completed = false;
try {
  // This smoke exercises a shipped authored crypt through the REAL public API.
  // The default new-game UI now starts Book One in swordhaven-first-book; the
  // retired swordhaven-square route must not be assumed or resurrected.
  // First-hour UI creation is covered separately by public-staging-journey.mjs.
  const expedition = await fetch(api + '/chronicles/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ mapId: 'crypt-eight-squares' }),
  });
  assert.equal(expedition.status, 201, 'Cannot create the shipped crypt expedition');
  const game = await expedition.json();
  assert.equal(game.currentMapId, 'crypt-eight-squares');
  assert.ok(game.runId, 'Real crypt expedition has no run ID');
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();
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
  // Load the server-created crypt run through the real Home resume flow.
  // Do not seed browser storage, inject a fake checkpoint or rely on the
  // retired Swordhaven map. The game still owns every subsequent action.
  await page.locator('[data-chronicles-primary-action="continue"] button.is-primary').click();
  // Wait for the ACTUAL crypt state before firing S; an earlier Home or
  // loading frame is not evidence that the expedition is playable.
  const crypt = page.locator('[data-chronicles="true"][data-chronicles-map-id="crypt-eight-squares"]');
  await crypt.waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });
  const cryptTurns = Number(await crypt.getAttribute('data-chronicles-turns'));
  assert.ok(Number.isInteger(cryptTurns), 'Crypt UI did not expose real turn count');
  console.log('CHRONICLES_PUBLIC_COMBAT_CRYPT_READY turns=' + cryptTurns);

  // With a real archer and the live crypt AI, S fires the opening volley.
  // Then approach the corrupted pawn and attempt a real melee action.
  await page.keyboard.press('s');
  await page.waitForFunction(previous =>
    Number(document.querySelector('[data-chronicles-map-id="crypt-eight-squares"]')?.getAttribute('data-chronicles-turns')) > previous,
    cryptTurns, { timeout: 12000 });
  // A collective opening volley spends exactly one exploration action. A
  // second tick here would let the enemy move/attack twice before contact.
  const afterVolleyTurns = Number(await crypt.getAttribute('data-chronicles-turns'));
  assert.equal(afterVolleyTurns, cryptTurns + 1,
    'Opening S volley must consume exactly one turn, never a duplicate tick');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('a');

  // Switch to the mobile controls and issue an actual touch attack as well.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-chronicles-touch-action="attack"]').click();
  // Saving in MM3 initiative is deliberately forbidden. Verify the lock,
  // then finish the real encounter with party melee actions before saving.
  const combatRail = page.locator('[data-chronicles-initiative="visible"]');
  assert.equal(await combatRail.count(), 1, 'The authored crypt must enter real initiative');
  await page.getByLabel('Abrir menú de Chronicles').click();
  assert.equal(await page.locator('[data-chronicles-menu-save]').isDisabled(), true,
    'Manual save must remain disabled during initiative');
  await page.getByRole('button', { name: 'Cerrar menú' }).click();
  for (let action = 0; action < 32 && await combatRail.count(); action++) {
    await page.waitForFunction(() => {
      const rail = document.querySelector('[data-chronicles-initiative="visible"]');
      return !rail || !rail.classList.contains('is-enemy-turn');
    }, null, { timeout: 12000 });
    if (!await combatRail.count()) break;
    const actor = await combatRail.getAttribute('aria-label');
    // The opening volley may force initiative from two cells away. In MM3
    // the party cannot move during combat and melee must not reach that far.
    // Block until the real enemy spends its own turn closing the distance.
    const attackButton = page.locator('[data-chronicles-touch-action="attack"]');
    const canMelee = await attackButton.getAttribute('data-melee-ready') === 'true'
      && await attackButton.isEnabled();
    const actionKey = canMelee ? 'a' : 'b';
    console.log('CHRONICLES_PUBLIC_COMBAT_ACTION ' + JSON.stringify({
      actor, action: canMelee ? 'melee' : 'block',
    }));
    await page.keyboard.press(actionKey);
    await page.waitForFunction(previous => {
      const rail = document.querySelector('[data-chronicles-initiative="visible"]');
      return !rail || rail.getAttribute('aria-label') !== previous;
    }, actor, { timeout: 12000 });
  }
  assert.equal(await combatRail.count(), 0,
    'The real crypt encounter must finish before the manual checkpoint');
  await page.getByLabel('Abrir menú de Chronicles').click();
  assert.equal(await page.locator('[data-chronicles-menu-save]').isEnabled(), true,
    'Saving must become available after victory');
  // A manual save may legally reuse the durable area-change checkpoint
  // when no gameplay state changed. Wait for the visible result, then inspect
  // the authoritative world the REAL Chronicles backend will reload.
  const saveResponses = [];
  page.on('response', response => {
    if (response.url().startsWith(api) && /\/chronicles\/runs\//.test(response.url())) {
      saveResponses.push(response.request().method() + ' ' + response.status() + ' '
        + new URL(response.url()).pathname.replace(game.runId, ':run'));
    }
  });
  // Use the stable menu action: its visible name includes the S shortcut.
  await page.locator('[data-chronicles-menu-save]').click();
  // Capture diagnostics before making a timeout the only actionable error.
  await page.waitForFunction(() =>
    Boolean(document.querySelector('.chronicles-game-menu__notice')?.textContent?.trim()),
    null, { timeout: 10000 }).catch(() => {});
  const saveMessage = await page.locator('.chronicles-game-menu__notice').textContent().catch(() => '');
  const openDialog = await page.locator('[data-chronicles-adventure-menu]').count();
  await page.screenshot({ path: 'chronicles-combat-mobile.png', fullPage: false });
  console.log('CHRONICLES_PUBLIC_COMBAT_SAVE ' + JSON.stringify({
    message: saveMessage?.trim() || '(none)', menuOpen: Boolean(openDialog),
    apiResponses: saveResponses.slice(-8), browserErrors: errors.slice(-3),
  }));
  const persisted = await fetch(api + '/chronicles/runs/' + encodeURIComponent(game.runId) + '/bootstrap', {
    headers: { Authorization: 'Bearer ' + token },
  });
  assert.equal(persisted.status, 200, 'Cannot read authoritative combat checkpoint');
  const saved = await persisted.json();
  assert.equal(saved.currentMapId, 'crypt-eight-squares');
  const flags = saved.worldFlags || {};
  const enemyHp = flags.enemyHp;
  const initiative = flags['__chrRuntime.initiative'];
  console.log('CHRONICLES_PUBLIC_COMBAT_STATE ' + JSON.stringify({
    enemyHp, initiativeStarted: Boolean(initiative), turns: flags['__chrRuntime.turns'],
    x: flags['__chrRuntime.x'], y: flags['__chrRuntime.y'],
  }));
  assert.equal(saveMessage?.trim(), 'Partida guardada correctamente.',
    'Manual combat save was not acknowledged by the real game UI');
  // Victory must be real, not inferred from a cosmetic attack animation.
  assert.equal(enemyHp, 0, 'The authored pawn must be defeated before saving');
  assert.deepEqual(errors, [], 'Browser exceptions during live combat');
  // F5 must recover the SAME server checkpoint, not a local copy or a
  // newly created expedition. Capture bootstrap before the reload so an
  // automatic resume and a Home -> Continuar flow are both supported.
  const restoredBootstrap = page.waitForResponse(r =>
    r.request().method() === 'GET'
      && new URL(r.url()).pathname === '/api/chronicles/runs/' + game.runId + '/bootstrap'
      && r.url().startsWith(api) && r.status() === 200,
  { timeout: 30_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    Boolean(document.querySelector('[data-chronicles-save-menu="home"]')
      || document.querySelector('[data-chronicles-map-id="crypt-eight-squares"]')),
    null, { timeout: 30_000 });
  if (await page.locator('[data-chronicles-save-menu="home"]').isVisible()) {
    await page.getByRole('button', { name: /Continuar expedición/ }).click();
  }
  const resumed = await (await restoredBootstrap).json();
  assert.equal(resumed.runId, game.runId, 'F5 resumed a different expedition');
  assert.equal(resumed.currentMapId, saved.currentMapId, 'F5 lost the crypt');
  for (const key of ['x', 'y', 'direction', 'turns', 'initiative']) {
    assert.deepEqual(resumed.worldFlags?.['__chrRuntime.' + key], flags['__chrRuntime.' + key],
      'F5 lost saved combat field: ' + key);
  }
  const restoredCrypt = page.locator('[data-chronicles="true"][data-chronicles-map-id="crypt-eight-squares"]');
  await restoredCrypt.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(Number(await restoredCrypt.getAttribute('data-chronicles-turns')),
    Number(flags['__chrRuntime.turns']), 'F5 added or lost a combat turn');
  assert.deepEqual(errors, [], 'Browser exceptions during combat restore');
  console.log('CHRONICLES_PUBLIC_COMBAT_RESTORE_OK crypt-eight-squares same-run');
  console.log('CHRONICLES_PUBLIC_COMBAT_OK crypt-eight-squares real-enemy');
  completed = true;
  await context.close();
} finally {
  // Preserve a browser frame even if an earlier selector or checkpoint fails.
  // Never let diagnostic capture prevent cleanup of the ephemeral account.
  if (!completed) await page?.screenshot({
    path: 'chronicles-combat-failure.png', fullPage: false, timeout: 5000,
  }).catch(() => {});
  await browser?.close();
  const deleted = await fetch(api + '/auth/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.ok(deleted.ok, 'Failed to delete ephemeral Chronicles combat account: ' + deleted.status);
}
