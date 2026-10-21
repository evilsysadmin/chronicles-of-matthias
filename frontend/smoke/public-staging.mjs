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
      ctx = await browser.newContext({ viewport });
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
            return {
              rootIndex: roots.indexOf(node.closest('[data-chronicles="true"]')),
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
