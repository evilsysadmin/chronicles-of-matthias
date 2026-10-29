// Real-public-URL browser smoke with a test-only SSO bridge; no shared IdP accounts.
// CI sets CHRONICLES_STAGING_INVITE_CODE; the account is always deleted.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { assertAdventureFolioInk } from './adventure-contrast.mjs';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
const expectedSha = process.env.CHRONICLES_SOURCE_SHA;
if (!invite || !/^[0-9a-f]{40}$/.test(expectedSha || '')) {
  throw new Error('Missing protected staging secret or exact release SHA');
}

const versionResponse = await fetch(`${origin}/release.json?ts=${Date.now()}`, { cache: 'no-store' });
assert.equal(versionResponse.status, 200);
const requireNoStore = (response, resource) => {
  const control = response.headers.get('cache-control') || '';
  assert.match(control, /(?:^|,)\s*no-store(?:\s*,|$)/i,
    'Public Pages ' + resource + ' must be uncacheable (Cache-Control: ' + (control || '<missing>') + ')');
};
requireNoStore(versionResponse, '/release.json');
const published = await versionResponse.json();
assert.equal(published.build, expectedSha, 'Public browser release must match admitted SHA');

// Verify the *actual root HTML* points at the assets built from this SHA.
// A versioned release.json can be fresh while Cloudflare still serves a
// cached old index.html; that produces mismatched styles and invisible ink.
const expectedIndex = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const rootResponse = await fetch(origin + '/', { cache: 'no-store' });
assert.ok(rootResponse.ok, 'Public staging root HTML is unavailable');
requireNoStore(rootResponse, '/');
const explicitIndex = await fetch(origin + '/index.html', { cache: 'no-store' });
assert.ok(explicitIndex.ok, 'Public Pages explicit index.html is unavailable');
requireNoStore(explicitIndex, '/index.html');
const actualIndex = await rootResponse.text();
function entrypointAssets(html) {
  return [...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"'?#]+)[^"']*["']/g)]
    .map((match) => match[1]).sort();
}
const expectedAssets = entrypointAssets(expectedIndex);
const actualAssets = entrypointAssets(actualIndex);
assert(expectedAssets.length > 0, 'Local Vite build has no entrypoint asset URLs');
console.log('CHRONICLES_PUBLIC_HTML_ASSETS', JSON.stringify({
  expected: expectedAssets, delivered: actualAssets,
}));
assert.deepEqual(actualAssets, expectedAssets,
  'Public HTML points to stale/mismatched JS/CSS, despite the release manifest SHA');

let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  // A first-time-entry smoke needs a truly new player in EACH viewport.
  // Cross-device continuity is exercised separately by public-staging-journey.mjs.
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const username = 'chromium-smoke-' + randomBytes(5).toString('hex');
    const password = randomBytes(20).toString('base64url');
    let token = null;
    let ctx = null;
    try {
      const registration = await fetch(api + '/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, email: username + '@example.com', inviteCode: invite }),
      });
      assert.ok(registration.ok, `Smoke registration HTTP ${registration.status}`);
      token = (await registration.json()).token;
      assert.ok(token, 'Missing cleanup token after registration');
      // A narrow desktop viewport is not a touch device. Exercise true tap
      // dispatch in the 390px public run without changing its viewport metrics.
      ctx = await browser.newContext({ viewport, hasTouch: viewport.width === 390 });
      const page = await ctx.newPage();
      // The live staging frontend delegates login to Chess Studio's shared
      // ShadowOps IdP. Stub ONLY that cross-origin credential exchange:
      // never create users at Chess Studio, and keep the app/API fully real.
      await page.route('https://api-staging.chess-studio.shadowops.dpdns.org/api/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const cors = {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type',
        };
        if (request.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: cors });
        } else if (url.pathname === '/api/identity/token') {
          // The temporary context has no existing SSO cookie.
          await route.fulfill({ status: 401, contentType: 'application/json', headers: cors,
            body: JSON.stringify({ detail: 'No session' }) });
        } else if (url.pathname === '/api/auth/login') {
          await route.fulfill({ status: 200, contentType: 'application/json', headers: cors,
            body: JSON.stringify({ token: 'temporary-idp-handshake' }) });
        } else if (url.pathname === '/api/identity/session') {
          await route.fulfill({ status: 200, contentType: 'application/json', headers: cors,
            body: JSON.stringify({ token, username, expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
        } else {
          throw new Error('Unexpected shared IdP request: ' + url.pathname);
        }
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Usuario').fill(username);
      await page.getByLabel('Contraseña').fill(password);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      // "Entrar" disappears immediately while loading; that alone is NOT a
      // successful login. Wait for the actual session and disappearance of
      // the login screen or surface its error explicitly.
      await page.waitForFunction(() =>
        Boolean(localStorage.getItem('chess-study-auth-token')), null, { timeout: 30_000 });
      await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor({
        state: 'hidden', timeout: 30_000,
      });
      await page.getByText('Cargando Chronicles…').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
      assert.ok(await page.evaluate(() => !!localStorage.getItem('chess-study-auth-token')),
        'Authenticated session was not preserved');
      assert.ok((await page.locator('#root').innerHTML()).length > 500, 'Empty authenticated game');
      assert.deepEqual(errors, [], 'Uncaught browser errors');
      assert.ok((await page.locator('#root').innerHTML()).includes('Chronicles'), 'Game did not render');

      // The browser must complete the real roster CORS preflight with the
      // exact API headers used by the client. A normal account must still be
      // denied with 403, not a TypeError caused by a blocked OPTIONS request.
      // No privileged credentials or roster contents are read here.
      const rosterCors = await page.evaluate(async ({ apiRoot, playerToken, release }) => {
        try {
          const response = await fetch(apiRoot + '/chronicles/admin/users', {
            method: 'GET',
            cache: 'no-store',
            headers: {
              Authorization: 'Bearer ' + playerToken,
              'X-Request-ID': 'chronicles-public-staging-smoke',
              'X-Client-Release': release,
            },
          });
          return { status: response.status };
        } catch (error) {
          return { browserError: error?.name || 'FetchError' };
        }
      }, { apiRoot: api, playerToken: token, release: expectedSha });
      assert.deepEqual(rosterCors, { status: 403 },
        'Admin roster must pass browser CORS and reject an ordinary player');
      console.log('CHRONICLES_PUBLIC_ADMIN_ROSTER_CORS_OK viewport=' + viewport.width);

      // Go beyond the expedition book: inspect the actual Three.js world and
      // both real folios against it. This account exists only for this run
      // and is removed in the finally block, along with its game data.
      const newRun = page.getByRole('button', { name: /Nueva expedición/ }).first();
      await newRun.click({ timeout: 45_000 });
      const setup = page.locator('[data-chronicles-character-setup="choice"]');
      try {
        await setup.waitFor({ state: 'visible', timeout: 20_000 });
      } catch (error) {
        // Distinguish a real new-run regression from a changed CTA label.
        // Keep screenshots even on failure; the release must still fail closed.
        const currentSetup = await page.locator('[data-chronicles-character-setup]')
          .first().getAttribute('data-chronicles-character-setup').catch(() => null);
        const currentMenu = await page.locator('[data-chronicles-save-menu]')
          .first().getAttribute('data-chronicles-save-menu').catch(() => null);
        console.error('CHRONICLES_PUBLIC_SETUP_UNAVAILABLE', JSON.stringify({
          viewport: viewport.width, currentSetup, currentMenu,
          excerpt: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 360),
        }));
        await page.screenshot({ path: `chronicles-public-setup-failed-${viewport.width}.png` }).catch(() => {});
        throw error;
      }
      // A returned player may have a saved custom build; both choices must
      // launch an actual expedition without forcing the canonical company.
      await setup.getByRole('button', {
        name: /^(Empezar con este grupo|Continuar con mi compañía)$/,
      }).click({ timeout: 20_000 });
      const world = page.locator('[data-chronicles="true"]');
      await world.waitFor({ state: 'visible', timeout: 90_000 });
      const canvas = world.locator('[data-chronicles-renderer="three"] canvas');
      await canvas.waitFor({ state: 'visible', timeout: 45_000 });
      await page.waitForTimeout(700); // at least one actual scene paint
      const frame = await canvas.boundingBox();
      assert.ok(frame && frame.width >= 100 && frame.height >= 80,
        'Actual Three.js viewport must be measurable');
      // The game may retain inactive DOM while transitioning between
      // screens. A plain locator.isVisible() is strict and fails on duplicates.
      // Only the actual visible guide can receive input. Multiple visible
      // guides are a genuine UX regression and must not be silently ignored.
      // Portrait mobile browsers can legitimately lose fullscreen after an
      // orientation request. The relock dialog is modal: choose its explicit
      // supported "Seguir en vertical" action rather than clicking through
      // the overlay or letting the guide click hang for 30 seconds.
      const relock = page.locator('[data-chronicles-relock]:visible');
      if (viewport.width === 390 && await relock.count()) {
        await relock.getByRole('button', { name: 'Seguir en vertical' }).click();
        await relock.waitFor({ state: 'hidden', timeout: 10_000 });
        console.log('CHRONICLES_PUBLIC_PORTRAIT_CHOICE_OK viewport=390');
      }
      assert.equal(await relock.count(), 0, 'Landscape relock must not obscure the first-steps guide');
      const firstSteps = world.locator('[data-chronicles-first-steps]:visible');
      const visibleFirstSteps = await firstSteps.count();
      if (visibleFirstSteps > 1) {
        // Playwright's :visible checks geometry, not whether an element is
        // occluded. Diagnose every candidate before changing game behavior.
        // Deliberately emit structural metadata only: no user/account text.
        const census = await page.evaluate(() => {
          const roots = [...document.querySelectorAll('[data-chronicles="true"]')];
          const nodes = [...document.querySelectorAll('[data-chronicles-first-steps]')];
          const describe = (node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
            const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
            const hit = document.elementFromPoint(x, y);
            const ancestors = [];
            for (let p = node.parentElement; p && ancestors.length < 6; p = p.parentElement) {
              ancestors.push({
                tag: p.tagName.toLowerCase(),
                cls: typeof p.className === 'string' ? p.className.slice(0, 100) : '',
                hidden: Boolean(p.hidden),
              });
            }
            // Inspect only React's host ownership and component type names;
            // never emit keys, props, session state or account data.
            const fiberProperty = Object.keys(node).find(key => key.startsWith('__reactFiber$'));
            const fiber = fiberProperty ? node[fiberProperty] : null;
            const fiberTypes = [];
            let reactParentMatchesDom = false;
            for (let f = fiber; f && fiberTypes.length < 12; f = f.return) {
              const type = f.type;
              const name = typeof type === 'string' ? type
                : typeof type === 'function' ? (type.displayName || type.name || 'function') : null;
              if (name) fiberTypes.push(name.slice(0, 90));
              if (f !== fiber && f.stateNode === node.parentElement) {
                reactParentMatchesDom = true;
              }
            }
            return {
              rootIndex: roots.indexOf(node.closest('[data-chronicles="true"]')),
              reactFiberAttached: Boolean(fiber),
              reactFiberHostMatches: Boolean(fiber && fiber.stateNode === node),
              reactParentMatchesDom,
              reactFiberTypes: fiberTypes,
              domSiblingIndex: [...node.parentElement.children].indexOf(node),
              tag: node.tagName.toLowerCase(),
              rect: [box.x, box.y, box.width, box.height].map(n => Math.round(n)),
              display: style.display, visibility: style.visibility,
              opacity: style.opacity, position: style.position,
              zIndex: style.zIndex, pointerEvents: style.pointerEvents,
              hitWithinGuide: Boolean(hit && node.contains(hit)),
              hitOwnGuide: Boolean(hit && hit.closest('[data-chronicles-first-steps]') === node),
              ancestors,
            };
          };
          return { worldRoots: roots.length, guideNodes: nodes.length,
            candidates: nodes.slice(0, 8).map(describe) };
        });
        console.error('CHRONICLES_FIRST_STEPS_DOM_CENSUS', JSON.stringify(census));
        await page.screenshot({
          path: `chronicles-public-first-steps-duplicate-${viewport.width}.png`,
        }).catch(() => {});
        throw new Error(`Multiple visible Matthias guides: ${visibleFirstSteps}`);
      }
      if (visibleFirstSteps === 1) {
        await firstSteps.getByRole('button', { name: 'Entendido' }).click();
      }
      await page.screenshot({ path: `chronicles-public-world-${viewport.width}.png` });

      // Real authenticated first-hour hero switching: inspect the first
      // companion's sheet, change to slot 4 and return via the same keyboard
      // bindings available in production. Don't assume a canonical name: a
      // returning account may have a valid custom four-hero company.
      const partyPortraits = world.locator('.chronicles-party-member');
      assert.ok(await partyPortraits.count() >= 4, 'An expedition has four selectable heroes');
      // Accessible labels also include live PV ("Seleccionar Matthias, 20/20 PV").
      // Read the visible hero names instead: folio titles contain names only.
      // This is part of the public browser regression, not a mocked UI.
      const firstHeroName = (await partyPortraits.nth(0).locator('strong').innerText()).trim();
      const fourthHeroName = (await partyPortraits.nth(3).locator('strong').innerText()).trim();
      assert.ok(firstHeroName && fourthHeroName, 'Missing hero names on actual party portraits');
      // Portraits select on one click/tap; the dossier opens on a desktop
      // double-click or a second quick touch tap (PR #867).
      if (viewport.width === 390) {
        await partyPortraits.first().tap();
        await partyPortraits.first().tap();
      } else {
        await partyPortraits.first().dblclick();
      }
      const heroFolio = page.locator('[role="dialog"][data-chronicles-folio="v2"]');
      await heroFolio.waitFor({ state: 'visible', timeout: 12_000 });
      // The state folio also has a "Cambiar equipo ›" action. Scope this
      // click to the actual tab and use an exact accessible name; a broad
      // substring match throws Playwright strict-mode on live staging.
      await heroFolio.locator('.chronicles-character-sheet__tabs')
        .getByRole('button', { name: 'Equipo', exact: true }).click();
      await page.keyboard.press('4');
      await page.waitForFunction((name) => document.querySelector(
        '[role="dialog"][data-chronicles-folio="v2"] #chronicles-character-sheet-title',
      )?.textContent?.trim() === name, fourthHeroName);
      assert.equal(await heroFolio.count(), 1, 'The hero folio must remain open on shortcut 4');
      assert.match(await heroFolio.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
        /Equipo/, 'Shortcut 4 must preserve the equipment tab');
      await page.keyboard.press('1');
      await page.waitForFunction((name) => document.querySelector(
        '[role="dialog"][data-chronicles-folio="v2"] #chronicles-character-sheet-title',
      )?.textContent?.trim() === name, firstHeroName);
      assert.match(await heroFolio.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
        /Equipo/, 'Shortcut 1 must preserve the equipment tab');

      if (viewport.width === 390) {
        // Real touch input, not a mouse click on a small viewport.
        // The compact hero dock exposes live HP in each accessible name.
        // Match the unique name prefix; the old exact name became stale
        // when the dock was simplified in PR #555.
        const fourthHeroButton = heroFolio.getByRole('button', {
          name: 'Ver ficha de ' + fourthHeroName + ',',
        });
        assert.match(await fourthHeroButton.getAttribute('aria-label'), /, \d+ de \d+ PV$/);
        await fourthHeroButton.tap();
        await page.waitForFunction((name) => document.querySelector(
          '[role="dialog"][data-chronicles-folio="v2"] #chronicles-character-sheet-title',
        )?.textContent?.trim() === name, fourthHeroName);
        assert.match(await heroFolio.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
          /Equipo/, 'Touch selection must keep the Equipment tab');
        const firstHeroButton = heroFolio.getByRole('button', {
          name: 'Ver ficha de ' + firstHeroName + ',',
        });
        assert.match(await firstHeroButton.getAttribute('aria-label'), /, \d+ de \d+ PV$/);
        await firstHeroButton.tap();
        await page.waitForFunction((name) => document.querySelector(
          '[role="dialog"][data-chronicles-folio="v2"] #chronicles-character-sheet-title',
        )?.textContent?.trim() === name, firstHeroName);
        assert.equal(await heroFolio.count(), 1, 'Touch hero navigation must not create extra dialogs');
        assert.match(await heroFolio.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
          /Equipo/, 'Returning by touch must preserve the Equipment tab');
      }
      // A failed close must reveal whether the button disappeared, lost its
      // accessible name or became hidden after hero/tab navigation. Keep the
      // real role-based click: never silently bypass an accessibility defect.
      try {
        await heroFolio.getByRole('button', { name: 'Cerrar ficha' }).click({ timeout: 5_000 });
      } catch (error) {
        const probe = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"][data-chronicles-folio="v2"]');
          const close = dialog?.querySelector('.chronicles-character-sheet__head > button');
          const style = close ? getComputedStyle(close) : null;
          const rect = close?.getBoundingClientRect();
          return {
            dialogPresent: Boolean(dialog),
            dialogAriaHidden: dialog?.getAttribute('aria-hidden') ?? null,
            closePresent: Boolean(close),
            closeLabel: close?.getAttribute('aria-label') ?? null,
            closeDisplay: style?.display ?? null,
            closeVisibility: style?.visibility ?? null,
            closeRect: rect ? { width: rect.width, height: rect.height } : null,
            dialogCount: document.querySelectorAll('[role="dialog"]').length,
            activeTab: dialog?.querySelector('.chronicles-character-sheet__tabs .is-active')?.textContent?.trim() ?? null,
          };
        });
        console.error('CHRONICLES_PUBLIC_HERO_CLOSE_PROBE', JSON.stringify({
          ...probe,
          accessibleCloseCount: await heroFolio.getByRole('button', { name: 'Cerrar ficha' }).count(),
          hiddenInclusiveCloseCount: await heroFolio.getByRole('button', { name: 'Cerrar ficha', includeHidden: true }).count(),
        }));
        throw error;
      }
      await heroFolio.waitFor({ state: 'hidden', timeout: 8_000 });

      async function verifyFolio(dialog, label) {
        await dialog.waitFor({ state: 'visible', timeout: 12_000 });
        const dimensions = await dialog.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            width: innerWidth, height: innerHeight, left: rect.left,
            top: rect.top, right: rect.right, bottom: rect.bottom,
            scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
          };
        });
        assert.ok(dimensions.left >= -1 && dimensions.right <= dimensions.width + 1
          && dimensions.top >= -1 && dimensions.bottom <= dimensions.height + 1,
          `${label} exceeds real game viewport: ${JSON.stringify(dimensions)}`);
        assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1,
          `${label} requires horizontal scrolling`);
        assert.ok(await canvas.isVisible(), '3D stage disappeared behind an overlay');
        if (label === 'adventure') {
          try {
            await assertAdventureFolioInk(dialog, `${viewport.width}x${viewport.height}`);
          } catch (error) {
            // Only public CSS/DOM metadata, never auth tokens or player details.
            const probe = await dialog.evaluate((root) => {
              const selectors = [
                '.chronicles-game-menu__actions > button',
                '.chronicles-audio-controls label',
                '.chronicles-game-menu__hint',
              ];
              const samples = selectors.map((selector) => {
                const el = root.querySelector(selector);
                const style = el && getComputedStyle(el);
                return { selector, cssColor: style?.color,
                  textFill: style?.getPropertyValue('-webkit-text-fill-color'),
                  className: el?.className || '' };
              });
              const sheets = [...document.styleSheets].map((sheet) => {
                try {
                  return { href: sheet.href, count: sheet.cssRules.length,
                    folioRules: [...sheet.cssRules].filter((rule) =>
                      rule.selectorText?.includes('chronicles-game-menu__panel--folio'))
                      .length };
                } catch { return { href: sheet.href, inaccessible: true }; }
              });
              return { samples, sheets };
            });
            console.error('CHRONICLES_PUBLIC_ADVENTURE_STYLE_PROBE', JSON.stringify(probe));
            throw error;
          }
        }
        await page.screenshot({ path: `chronicles-public-${label}-${viewport.width}.png` });
        console.log(`CHRONICLES_PUBLIC_FOLIO_OK name=${label} viewport=${viewport.width}`);
      }

      // Slot 2 of the canonical party is a caster. Use the same public
      // keyboard shortcut and UI that an actual player sees.
      await page.keyboard.press('2');
      await page.keyboard.press('c');
      const spellbook = page.locator('[data-chronicles-spell-menu]');
      await verifyFolio(spellbook, 'cast');
      assert.ok(await spellbook.locator('[data-chronicles-cast]').count() > 0,
        'Expected real spells and costs for the selected caster');
      await spellbook.getByRole('tab', { name: /Objetos/ }).click();
      assert.equal(await spellbook.getAttribute('data-chronicles-menu-tab'), 'items');
      await verifyFolio(spellbook, 'items');
      await page.keyboard.press('Escape');
      await spellbook.waitFor({ state: 'hidden', timeout: 8_000 });

      // The pause menu must be the real in-game menu, not a fixture screenshot.
      await world.locator('details.chronicles-game-menu > summary').click();
      const adventure = world.locator('[data-chronicles-adventure-menu]');
      await verifyFolio(adventure, 'adventure');
      await adventure.getByRole('button', { name: 'Salir sin guardar' }).click();
      await adventure.getByRole('group', { name: 'Confirmar salida sin guardar' }).waitFor();
      await adventure.getByRole('button', { name: 'Cancelar' }).click();
      await adventure.getByRole('group', { name: 'Confirmar salida sin guardar' })
        .waitFor({ state: 'hidden' });
      await adventure.getByRole('button', { name: /Continuar/ }).click();
      await adventure.waitFor({ state: 'hidden', timeout: 8_000 });
      assert.deepEqual(errors, [], 'Browser errors after entering the real world and folios');

      // Simulate an incoming newer build during an authenticated expedition.
      await page.route('**/release.json*', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ release: published.release, build: 'b'.repeat(40) === expectedSha ? 'c'.repeat(40) : 'b'.repeat(40) }),
      }));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const banner = page.getByRole('status').filter({ hasText: 'Nueva versión disponible' });
      await banner.waitFor({ timeout: 15_000 });
      assert.equal(await banner.getByRole('button', { name: 'Actualizar', exact: true }).count(), 0,
        'Must never expose a mid-expedition reload button');
      await banner.getByRole('button', { name: 'Después' }).click();
      await banner.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).count(), 0,
        'Update snooze must not log the player out');
      await page.screenshot({ path: `chronicles-public-${viewport.width}.png`, fullPage: false });

      // The first hour is not complete if a player cannot find the expedition
      // again. Exercise the REAL API-backed save, exit, browser reload and
      // resume UI. Avoid inspecting or logging tokens, checkpoint payloads or
      // user data; the only identity comparison uses accessible portrait labels.
      await world.locator('details.chronicles-game-menu > summary').click();
      const saveAndExitMenu = world.locator('[data-chronicles-adventure-menu]');
      await saveAndExitMenu.waitFor({ state: 'visible', timeout: 8_000 });
      await saveAndExitMenu.getByRole('button', { name: 'Guardar partida' }).click();
      await saveAndExitMenu.getByRole('status').filter({
        hasText: 'Partida guardada correctamente.',
      }).waitFor({ state: 'visible', timeout: 30_000 });
      await saveAndExitMenu.getByRole('button', { name: 'Guardar y salir' }).click();
      const expeditionBook = page.locator('[data-chronicles-save-menu="home"]');
      await expeditionBook.waitFor({ state: 'visible', timeout: 30_000 });
      await expeditionBook.getByRole('button', { name: /Continuar expedición/ })
        .waitFor({ state: 'visible', timeout: 30_000 });
      await page.screenshot({
        path: `chronicles-public-return-to-book-${viewport.width}.png`, fullPage: false,
      });

      // The book must still offer the same saved run after an actual F5,
      // not merely retain a mounted React component in memory.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const recoveredBook = page.locator('[data-chronicles-save-menu="home"]');
      await recoveredBook.waitFor({ state: 'visible', timeout: 45_000 });
      await recoveredBook.getByRole('button', { name: /Continuar expedición/ })
        .click({ timeout: 30_000 });
      await world.waitFor({ state: 'visible', timeout: 90_000 });
      await canvas.waitFor({ state: 'visible', timeout: 45_000 });
      const resumedFirstName = (await world.locator('.chronicles-party-member').first()
        .getAttribute('aria-label'))?.replace(/^Seleccionar /, '');
      assert.equal(resumedFirstName, firstHeroName,
        'The same lead hero must survive server save, exit, F5 and resume');
      assert.deepEqual(errors, [], 'Browser errors during public save / exit / resume');
      await page.screenshot({
        path: `chronicles-public-resumed-${viewport.width}.png`, fullPage: false,
      });
      console.log(`CHRONICLES_PUBLIC_BROWSER_OK viewport=${viewport.width}`);
    } finally {
      await ctx?.close();
      if (token) {
        const removed = await fetch(api + '/auth/delete-account', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ password }),
        });
        assert.ok(removed.ok, `Smoke account cleanup HTTP ${removed.status}`);
      }
    }
  }
} finally {
  await browser?.close();
}
