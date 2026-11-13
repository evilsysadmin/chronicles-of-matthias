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
  playtestOutcome, playtestSummary, playtestFailureEpisode,
  playtestMobileTouchAction, verifyPlaytestCheckpoint,
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

// Exercise the displayed stone controls on the 390px profile. No synthetic
// keyboard input or invocation of internal React handlers is allowed.
async function tapMobileAction(page, action) {
  const control = playtestMobileTouchAction(action);
  assert.ok(control, 'BOT_TOUCH_UNSUPPORTED_ACTION ' + String(action));
  const movement = ['forward', 'backward', 'strafe-left', 'strafe-right'].includes(control);
  const selector = movement
    ? '[data-chronicles-effective-action="' + control + '"]'
    : '[data-chronicles-touch-action="' + control + '"]';
  const button = page.locator(selector);
  assert.equal(await button.count(), 1, 'BOT_TOUCH_CONTROL_MISSING ' + control);
  assert.equal(await button.isEnabled(), true, 'BOT_TOUCH_CONTROL_DISABLED ' + control);
  if (action === 'a' || action === 's') {
    assert.equal(await button.getAttribute('data-chronicles-touch-attack-mode'),
      action === 'a' ? 'melee' : 'missile', 'BOT_TOUCH_WRONG_ATTACK_MODE');
  }
  await button.tap();
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

/**
 * Use the public menu and real API for a checkpoint followed by a browser F5.
 * This runs before the first risky move, guaranteeing both profiles exercise
 * persistence even if combat later ends in a legitimate defeat.
 */
async function saveReloadProbe(page, runId, token, expected) {
  assert.equal(expected.phase, 'explore', 'Save probe must start outside combat');
  assert.equal(expected.initiative, false, 'Cannot save while initiative is active');
  await page.getByLabel('Abrir menú de Chronicles').click();
  const save = page.locator('[data-chronicles-menu-save]');
  await save.waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await save.isEnabled(), true, 'Out-of-combat checkpoint must be enabled');
  const saving = page.waitForResponse(r => r.url().startsWith(api)
    && new URL(r.url()).pathname === '/api/chronicles/runs/' + runId + '/checkpoint'
    && r.request().method() === 'PUT', { timeout: 25_000 });
  await save.click();
  assert.equal((await saving).status(), 200, 'Bot could not save real staging run');
  const check = await fetch(api + '/chronicles/runs/' + encodeURIComponent(runId) + '/bootstrap', {
    headers: { Authorization: 'Bearer ' + token },
  });
  assert.equal(check.status, 200, 'Saved checkpoint cannot be read from server');
  const saved = await check.json();
  // F5 tests the public resume flow, not merely two backend GET requests.
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
  const restored = await (await resumed).json();
  const verified = verifyPlaytestCheckpoint({
    runId, mapId: expected.mapId, turns: expected.turns, saved, restored,
  });
  await page.locator('[data-chronicles="true"][data-chronicles-map-id="crypt-eight-squares"]')
    .waitFor({ state: 'visible', timeout: 30_000 });
  // Some first-run overlays are session-scoped and may reappear after F5.
  // Resume the same public tutorial dismissal before attempting more moves.
  const firstSteps = page.locator('[data-chronicles-first-steps]');
  if (await firstSteps.isVisible().catch(() => false)) {
    await firstSteps.getByRole('button', { name: 'Entendido' }).click();
  }
  const displayed = await observe(page);
  assert.equal(displayed.mapId, expected.mapId, 'F5 changed the visible map');
  assert.equal(displayed.turns, expected.turns, 'F5 changed the visible turn count');
  assert.equal(displayed.partyHp, expected.partyHp, 'F5 changed visible party health');
  return verified;
}

async function runEpisode(profile, seed, viewport) {
  const username = 'playtest-' + randomBytes(6).toString('hex');
  const password = randomBytes(21).toString('base64url');
  let token = null;
  let session = null;
  let runId = null;
  const trace = [];
  let outcome = 'error';
  let lastObserved = null;
  const readObservation = async (page) => {
    const state = await observe(page);
    lastObserved = state;
    return state;
  };
  const diagnostic = () => ({
    lastObserved,
    trace: trace.slice(-24),
  });
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
    const initial = await readObservation(page);
    assert.equal(initial.mapId, 'crypt-eight-squares');
    assert.ok(Number.isInteger(initial.turns) && initial.partyHp > 0,
      'No real combat stats after bootstrap');
    // A defeat is a valid gameplay outcome; it must not skip save/F5 coverage.
    const preCombatCheckpoint = await saveReloadProbe(page, runId, token, initial);

    let explorationActions = 0;
    let combatActions = 0;
    let blocked = 0;
    let combatEntered = false;
    let combatBlocked = 0;
    let repositionSteps = 0;
    let rejectedCombatMoves = 0;
    let meleeOpportunities = 0;
    const record = (action, state) => trace.push({
      action, turns: state.turns, partyHp: state.partyHp,
      initiative: state.initiative, phase: state.phase,
      actor: state.actor, elapsedMs: Date.now() - started,
    });

    while (explorationActions < PLAYTEST_MAX_EXPLORATION_ACTIONS) {
      const before = await readObservation(page);
      if (before.initiative || before.phase !== 'explore') break;
      const action = playtestAction({ profile, observed: before,
        explorationActions, blocked, seed });
      if (!action) break;
      if (viewport.width <= 430) {
        // The opening volley can be unavailable with a party that has no
        // ranged weapon. Do not fake S through a hardware keyboard.
        if (action === 's') {
          const attack = page.locator('[data-chronicles-touch-action="attack"]');
          const available = await attack.getAttribute('data-chronicles-touch-attack-mode') === 'missile'
            && await attack.isEnabled();
          if (!available) {
            explorationActions += 1;
            record('s-unavailable', before);
            continue;
          }
        }
        await tapMobileAction(page, action);
      } else {
        await page.keyboard.press(action);
      }
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
      const after = await readObservation(page);
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
      const before = await readObservation(page);
      if (!before.initiative || ['defeated', 'escaped'].includes(before.phase)) break;
      combatEntered = true;
      assert.ok(before.actor && before.mapId === 'crypt-eight-squares',
        'Live initiative lost its actor or map');
      const action = playtestAction({ profile, observed: before,
        combatActions: combatActions - rejectedCombatMoves,
        repositionSteps, blocked: combatBlocked, seed });
      const isMove = ['ArrowUp', 'ArrowDown', 'q', 'e'].includes(action);
      assert.ok(isMove || action === 'a' || action === 'b',
        'Bot must not rotate, teleport or use illegal moves in initiative');
      // Every mobile combat action, including Q/E lateral steps, is a
      // genuine touch event on the visible control; desktop uses keyboard.
      if (viewport.width <= 430) {
        await tapMobileAction(page, action);
      } else {
        await page.keyboard.press(action);
      }
      try {
        await page.waitForFunction(previous => {
          const rail = document.querySelector('[data-chronicles-initiative="visible"]');
          const root = document.querySelector('[data-chronicles="true"]');
          return !rail || ['defeated', 'escaped'].includes(root?.getAttribute('data-chronicles-phase'))
            || rail.getAttribute('aria-label') !== previous.actor
            || Number(root?.getAttribute('data-chronicles-turns')) > previous.turns;
        }, { actor: before.actor, turns: before.turns }, { timeout: isMove ? 2_000 : 12_000 });
      } catch (error) {
        if (!isMove) throw error;
        const unchanged = await readObservation(page);
        // Only classify an input as rejected if the real turn and actor did
        // not advance. A slow/ambiguous transition is an actual bot error.
        if (!unchanged.initiative || unchanged.actor !== before.actor
          || unchanged.turns !== before.turns) throw error;
        combatBlocked += 1;
        rejectedCombatMoves += 1;
        record(action + '-rejected', unchanged);
        continue;
      }
      if (isMove || action === 'b') {
        combatBlocked = 0;
        repositionSteps += 1;
      }
      // Count only accepted initiative actions; a collision rejected without
      // cost must not look like a genuine opportunity to fight.
      if (before.meleeReady) meleeOpportunities += 1;
      record(action, await readObservation(page));
    }

    const after = await readObservation(page);
    assert.deepEqual(errors, [], 'Real browser exceptions during playtest');
    let enemyHp = null;
    const saved = true; // pre-combat checkpoint passed, even if the party fell
    const restored = true;
    let postCombatSaved = false;
    let postCombatRestored = false;
    if (after.phase === 'explore' && !after.initiative) {
      const postCombatCheckpoint = await saveReloadProbe(page, runId, token, after);
      enemyHp = postCombatCheckpoint.enemyHp;
      postCombatSaved = true;
      postCombatRestored = true;
    }
    // Rejected collision probes cost no initiative action and must not skew
    // battle length or comparative balance metrics.
    const committedCombatActions = combatActions - rejectedCombatMoves;
    const result = playtestOutcome({ observed: after, enemyHp, combatEntered,
      explorationActions, combatActions: committedCombatActions,
      startHp: initial.partyHp, endHp: after.partyHp,
      meleeOpportunities, rejectedCombatMoves });
    outcome = result.outcome;
    const metrics = {
      profile, seed, viewport: viewport.width, mapId: initial.mapId,
      inputMode: viewport.width <= 430 ? 'touch' : 'keyboard',
      ...result, explorationActions, combatActions: committedCombatActions,
      attemptedCombatInputs: combatActions, combatEntered,
      initialHp: initial.partyHp, finalHp: after.partyHp,
      lastTurn: after.turns, blocked, rejectedCombatMoves,
      meleeOpportunities, repositionSteps,
      saved, restored, preCombatSaved: saved, preCombatRestored: restored,
      preCombatEnemyHp: preCombatCheckpoint.enemyHp,
      postCombatSaved, postCombatRestored, trace,
    };
    await page.screenshot({
      path: 'chronicles-playtest-' + profile + '.png', timeout: 10_000,
    }).catch(() => {});
    console.log('CHRONICLES_PLAYTEST_EPISODE ' + JSON.stringify({
      profile, outcome, explorationActions, combatActions: committedCombatActions,
      attemptedCombatInputs: combatActions, hpLost: result.hpLost,
      warnings: result.warnings, saved, restored, postCombatSaved, postCombatRestored,
    }));
    return metrics;
  } catch (error) {
    // Preserve actionable evidence when an assertion, browser operation or
    // save check fails after several real actions. No auth details attached.
    error.playtestDiagnostic = diagnostic();
    throw error;
  } finally {
    if (outcome === 'error') {
      await session?.page?.screenshot({
        path: 'chronicles-playtest-failure-' + profile + '.png', timeout: 5000,
      }).catch(() => {});
    }
    await session?.context?.close().catch(() => {});
    if (token) {
      try {
        const deleted = await fetch(api + '/auth/delete-account', {
          method: 'POST', headers: {
            'content-type': 'application/json', Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ password }),
        });
        assert.ok(deleted.ok, 'BOT_ACCOUNT_CLEANUP_FAILED HTTP ' + deleted.status);
        await assertPlaytestAccountRevoked(fetch, api, username, password);
      } catch (error) {
        error.playtestDiagnostic = diagnostic();
        throw error;
      }
    }
  }
}

try {
  for (const [index, profile] of PLAYTEST_PROFILES.entries()) {
    try {
      observations.push(await runEpisode(profile, index + 1, index
        ? { width: 390, height: 844 } : { width: 1280, height: 800 }));
    } catch (error) {
      observations.push(playtestFailureEpisode({
        profile, seed: index + 1, viewport: index ? 390 : 1280,
        ...(error.playtestDiagnostic ?? {}),
        error: error.message,
      }));
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
