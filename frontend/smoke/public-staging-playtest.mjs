// Nightly/opt-in autonomous playtest against the ACTUAL published staging
// frontend and Go+Mongo backend. Unlike a fixed click script, the player
// observes DOM state after each action and picks its next move using a
// reproducible, bounded policy. Only Chess Studio's cross-origin SSO bridge
// is simulated; all game actions, combat, saves and reloads are real.
//
// This is exploratory QA, not an LLM/vision agent and not a proof of balance.
// Defeats and long fights are measurements; runtime errors, impossible turn
// transitions and lost authoritative saves are test failures.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  PLAYTEST_PROFILES, PLAYTEST_MAX_COMBAT_ACTIONS,
  PLAYTEST_MAX_EXPLORATION_ACTIONS, playtestAction,
  playtestOutcome, playtestSummary,
} from './playtest-policy.mjs';
import { assertPlaytestAccountRevoked } from './playtest-cleanup.mjs';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const identity = 'https://api-staging.chess-studio.shadowops.dpdns.org/api/**';
const sha = process.env.CHRONICLES_SOURCE_SHA;
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
if (!/^[a-f0-9]{40}$/.test(sha || '') || !invite) {
  throw new Error('Playtest requires admitted staging SHA and invite secret');
}
const release = await fetch(origin + '/release.json?playtest=' + Date.now(), { cache: 'no-store' });
assert.equal(release.status, 200, 'Chronicles public release unavailable');
assert.equal((await release.json()).build, sha, 'Bot must run only against exact published SHA');

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const observations = [];
const started = Date.now();

function observe(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-chronicles="true"]');
    const rail = document.querySelector('[data-chronicles-initiative="visible"]');
    const attack = document.querySelector('[data-chronicles-touch-action="attack"]');
    return {
      mapId: root?.getAttribute('data-chronicles-map-id') || null,
      phase: root?.getAttribute('data-chronicles-phase') || null,
      turns: Number(root?.getAttribute('data-chronicles-turns')),
      partyHp: Number(root?.getAttribute('data-party-hp-total')),
      initiative: Boolean(rail),
      enemyTurn: Boolean(rail?.classList.contains('is-enemy-turn')
        || root?.getAttribute('data-turn-phase') === 'enemy'),
      actor: rail?.getAttribute('aria-label') || null,
      meleeReady: attack?.getAttribute('data-melee-ready') === 'true' && !attack?.disabled,
    };
  });
}

async function browserSession(browser, username, password, token, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 430 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Scope the sole stub to the established shared IdP handoff. Nothing under
  // the actual Chronicles API is intercepted, altered or fabricated.
  await page.route(identity, async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
    } else if (path === '/api/identity/token') {
      await route.fulfill({ status: 401, headers, contentType: 'application/json', body: '{}' });
    } else if (path === '/api/auth/login') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json',
        body: '{"token":"playtest-idp-handoff"}' });
    } else if (path === '/api/identity/session') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json',
        body: JSON.stringify({ username, token, expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
    } else {
      throw new Error('Unexpected shared identity endpoint ' + path);
    }
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('chess-study-auth-token')),
    null, { timeout: 30_000 });
  await page.locator('[data-chronicles-save-menu="home"]').waitFor({ timeout: 30_000 });
  await page.locator('[data-chronicles-primary-action="continue"] button.is-primary').click();
  const world = page.locator('[data-chronicles="true"][data-chronicles-map-id="crypt-eight-squares"]');
  await world.waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30_000 });
  const firstSteps = page.locator('[data-chronicles-first-steps]');
  if (await firstSteps.isVisible().catch(() => false)) {
    await firstSteps.getByRole('button', { name: 'Entendido' }).click();
  }
  return { context, page, world, errors };
}

async function runEpisode(profile, seed, viewport) {
  const username = 'playtest-' + randomBytes(6).toString('hex');
  const password = randomBytes(21).toString('base64url');
  let token = null;
  let session = null;
  let runId = null;
  const trace = [];
  let outcome = 'error';
  try {
    const registration = await fetch(api + '/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username, password, email: username + '@example.com', inviteCode: invite,
      }),
    });
    assert.equal(registration.status, 201, 'Cannot register short-lived staging playtest user');
    token = (await registration.json()).token;
    assert.ok(token);
    const creation = await fetch(api + '/chronicles/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ mapId: 'crypt-eight-squares' }),
    });
    assert.equal(creation.status, 201, 'Cannot create authored crypt expedition');
    const run = await creation.json();
    runId = run.runId;
    assert.ok(runId && run.currentMapId === 'crypt-eight-squares');
    session = await browserSession(browser, username, password, token, viewport);
    const { page, world, errors } = session;
    const initial = await observe(page);
    assert.equal(initial.mapId, 'crypt-eight-squares');
    assert.ok(Number.isInteger(initial.turns) && initial.partyHp > 0,
      'No real combat stats after bootstrap');

    let explorationActions = 0;
    let combatActions = 0;
    let blocked = 0;
    let combatEntered = false;
    const record = (action, state) => trace.push({
      action, turns: state.turns, partyHp: state.partyHp,
      initiative: state.initiative, phase: state.phase,
      actor: state.actor, elapsedMs: Date.now() - started,
    });

    while (explorationActions < PLAYTEST_MAX_EXPLORATION_ACTIONS) {
      const before = await observe(page);
      if (before.initiative || before.phase !== 'explore') break;
      const action = playtestAction({ profile, observed: before,
        explorationActions, blocked, seed });
      if (!action) break;
      await page.keyboard.press(action);
      explorationActions += 1;
      try {
        await page.waitForFunction(previous => {
          const root = document.querySelector('[data-chronicles="true"]');
          return Number(root?.getAttribute('data-chronicles-turns')) > previous
            || Boolean(document.querySelector('[data-chronicles-initiative="visible"]'))
            || root?.getAttribute('data-chronicles-phase') !== 'explore';
        }, before.turns, { timeout: 7000 });
      } catch {
        blocked += 1;
        // A wall is not a game softlock. A policy that cannot move after
        // repeated attempts is one; the report records the blocked inputs.
        if (blocked >= 5) throw new Error('BOT_SOFTLOCK_EXPLORE five rejected actions');
      }
      const after = await observe(page);
      assert.equal(after.mapId, 'crypt-eight-squares', 'Playtester lost the real game view');
      assert.ok(Number.isFinite(after.partyHp) && after.partyHp >= 0, 'Playtester lost party health');
      if (after.turns > before.turns) blocked = 0;
      record(action, after);
      if (after.initiative) { combatEntered = true; break; }
    }

    for (; combatActions < PLAYTEST_MAX_COMBAT_ACTIONS; combatActions += 1) {
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-chronicles="true"]');
        const rail = document.querySelector('[data-chronicles-initiative="visible"]');
        return !rail || !(rail.classList.contains('is-enemy-turn')
          || root?.getAttribute('data-turn-phase') === 'enemy');
      }, null, { timeout: 15_000 });
      const before = await observe(page);
      if (!before.initiative || ['defeated', 'escaped'].includes(before.phase)) break;
      combatEntered = true;
      assert.ok(before.actor && before.mapId === 'crypt-eight-squares',
        'Live initiative lost its actor or map');
      const action = playtestAction({ profile, observed: before, combatActions, seed });
      assert.ok(action === 'a' || action === 'b',
        'Bot must not rotate, teleport or use illegal moves in initiative');
      // Once per profile, use the real mobile button instead of keyboard.
      if (viewport.width <= 430 && combatActions === 0) {
        const button = page.locator('[data-chronicles-touch-action="' +
          (action === 'a' ? 'attack' : 'block') + '"]');
        await button.click();
      } else {
        await page.keyboard.press(action);
      }
      await page.waitForFunction(previous => {
        const rail = document.querySelector('[data-chronicles-initiative="visible"]');
        const root = document.querySelector('[data-chronicles="true"]');
        return !rail || ['defeated', 'escaped'].includes(root?.getAttribute('data-chronicles-phase'))
          || rail.getAttribute('aria-label') !== previous;
      }, before.actor, { timeout: 12_000 });
      record(action, await observe(page));
    }

    const after = await observe(page);
    assert.deepEqual(errors, [], 'Real browser exceptions during playtest');
    let enemyHp = null;
    let saved = false;
    let restored = false;
    if (after.phase === 'explore' && !after.initiative) {
      await page.getByLabel('Abrir menú de Chronicles').click();
      const save = page.locator('[data-chronicles-menu-save]');
      await save.waitFor({ state: 'visible', timeout: 10_000 });
      assert.equal(await save.isEnabled(), true, 'Out-of-combat checkpoint must be enabled');
      const saving = page.waitForResponse(r => r.url().startsWith(api)
        && new URL(r.url()).pathname === '/api/chronicles/runs/' + runId + '/checkpoint'
        && r.request().method() === 'PUT', { timeout: 25_000 });
      await save.click();
      assert.equal((await saving).status(), 200, 'Bot could not save real staging run');
      saved = true;
      const check = await fetch(api + '/chronicles/runs/' + encodeURIComponent(runId) + '/bootstrap', {
        headers: { Authorization: 'Bearer ' + token },
      });
      assert.equal(check.status, 200);
      const payload = await check.json();
      assert.equal(payload.runId, runId);
      assert.equal(payload.currentMapId, 'crypt-eight-squares');
      assert.equal(payload.worldFlags?.['__chrRuntime.turns'], after.turns,
        'Saved run lost the real number of actions');
      enemyHp = Number(payload.worldFlags?.enemyHp);
      assert.ok(Number.isInteger(enemyHp) && enemyHp >= 0);
      // F5 probes the public recovery flow, not merely the backend response.
      const resumed = page.waitForResponse(r => r.url().startsWith(api)
        && new URL(r.url()).pathname === '/api/chronicles/runs/' + runId + '/bootstrap'
        && r.request().method() === 'GET' && r.status() === 200, { timeout: 30_000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(
        document.querySelector('[data-chronicles-save-menu="home"]')
        || document.querySelector('[data-chronicles-map-id="crypt-eight-squares"]')),
      null, { timeout: 30_000 });
      if (await page.locator('[data-chronicles-save-menu="home"]').isVisible()) {
        await page.getByRole('button', { name: /Continuar expedición/ }).click();
      }
      const restoredRun = await (await resumed).json();
      assert.equal(restoredRun.runId, runId, 'F5 switched expeditions');
      assert.equal(restoredRun.worldFlags?.['__chrRuntime.turns'], after.turns,
        'F5 lost playtest actions');
      assert.equal(restoredRun.worldFlags?.enemyHp, enemyHp,
        'F5 resurrected or invented an enemy');
      restored = true;
    }
    const result = playtestOutcome({ observed: after, enemyHp, combatEntered,
      explorationActions, combatActions, startHp: initial.partyHp, endHp: after.partyHp });
    outcome = result.outcome;
    const metrics = {
      profile, seed, viewport: viewport.width, mapId: initial.mapId,
      ...result, explorationActions, combatActions, combatEntered,
      initialHp: initial.partyHp, finalHp: after.partyHp,
      lastTurn: after.turns, blocked, saved, restored, trace,
    };
    await page.screenshot({
      path: 'chronicles-playtest-' + profile + '.png', timeout: 10_000,
    }).catch(() => {});
    console.log('CHRONICLES_PLAYTEST_EPISODE ' + JSON.stringify({
      profile, outcome, explorationActions, combatActions, hpLost: result.hpLost,
      warnings: result.warnings, saved, restored,
    }));
    return metrics;
  } finally {
    if (outcome === 'error') {
      await session?.page?.screenshot({
        path: 'chronicles-playtest-failure-' + profile + '.png', timeout: 5000,
      }).catch(() => {});
    }
    await session?.context?.close().catch(() => {});
    if (token) {
      const deleted = await fetch(api + '/auth/delete-account', {
        method: 'POST', headers: {
          'content-type': 'application/json', Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ password }),
      });
      assert.ok(deleted.ok, 'BOT_ACCOUNT_CLEANUP_FAILED HTTP ' + deleted.status);
      await assertPlaytestAccountRevoked(fetch, api, username, password);
    }
  }
}

try {
  for (const [index, profile] of PLAYTEST_PROFILES.entries()) {
    try {
      observations.push(await runEpisode(profile, index + 1, index
        ? { width: 390, height: 844 } : { width: 1280, height: 800 }));
    } catch (error) {
      observations.push({ profile, outcome: 'error', hpLost: 0, actions: 0,
        warnings: ['bot-execution-failed'], error: String(error.message).slice(0, 480) });
    }
  }
} finally {
  await browser.close();
  const report = {
    schema: 'chronicles-playtest-v1', sourceSha: sha, environment: 'staging',
    generatedAt: new Date().toISOString(),
    summary: playtestSummary(observations),
    episodes: observations,
  };
  writeFileSync('chronicles-playtest-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log('CHRONICLES_PLAYTEST_REPORT ' + JSON.stringify(report.summary));
}
if (observations.some(item => item.outcome === 'error')) {
  throw new Error('CHRONICLES_PLAYTEST_RUN_FAILURE; inspect uploaded JSON and PNG diagnostics');
}
