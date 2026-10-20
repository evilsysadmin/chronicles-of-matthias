// Real-public-URL browser smoke with a test-only SSO bridge; no shared IdP accounts.
// CI sets CHRONICLES_STAGING_INVITE_CODE; the account is always deleted.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const api = 'https://chronicles-api-staging.shadowops.dpdns.org/api';
const invite = process.env.CHRONICLES_STAGING_INVITE_CODE;
const expectedSha = process.env.CHRONICLES_SOURCE_SHA;
if (!invite || !/^[0-9a-f]{40}$/.test(expectedSha || '')) {
  throw new Error('Missing protected staging secret or exact release SHA');
}

const versionResponse = await fetch(`${origin}/release.json?ts=${Date.now()}`, { cache: 'no-store' });
assert.equal(versionResponse.status, 200);
const published = await versionResponse.json();
assert.equal(published.build, expectedSha, 'Public browser release must match admitted SHA');

const username = 'chromium-smoke-' + randomBytes(5).toString('hex');
const password = randomBytes(20).toString('base64url');
const registration = await fetch(api + '/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password, email: `${username}@example.com`, inviteCode: invite }),
});
assert.ok(registration.ok, `Smoke registration HTTP ${registration.status}`);
const created = await registration.json();
const token = created.token;
assert.ok(token, 'Missing cleanup token after registration');

let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport });
    try {
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
      await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor({ state: 'hidden', timeout: 30_000 });
      await page.getByText('Cargando Chronicles…').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
      assert.ok((await page.locator('#root').innerHTML()).length > 500, 'Empty authenticated game');
      assert.deepEqual(errors, [], 'Uncaught browser errors');
      assert.ok((await page.locator('#root').innerHTML()).includes('Chronicles'), 'Game did not render');

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
      await ctx.close();
    }
  }
} finally {
  await browser?.close();
  const removed = await fetch(api + '/auth/delete-account', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  assert.ok(removed.ok, `Smoke account cleanup HTTP ${removed.status}`);
}
