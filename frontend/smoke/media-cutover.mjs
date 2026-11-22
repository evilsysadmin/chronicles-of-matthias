// This smoke remains local-only before the media CDN cutover. Once the
// source manifest switches, verify real public bytes in Chromium before merge.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  TARGET, ORIGIN, PINS, validateManifest, validateResponse,
} from '../../scripts/chronicles-media-cutover-gate.mjs';

const manifest = JSON.parse(readFileSync(
  new URL('../src/assets/r2-assets-manifest.json', import.meta.url), 'utf8'));
const mode = validateManifest(manifest);
if (mode === 'legacy') {
  console.log('CHRONICLES_MEDIA_BROWSER_CUTOVER_SKIPPED mode=legacy requests=0');
} else {
  const base = process.argv[2] || 'http://localhost:4174/';
  const pageUrl = new URL('smoke/media-cutover.html', base).href;
  const expected = new Map(
    Object.values(PINS).filter(pin => pin.key.endsWith('.mp3') || pin.key.endsWith('.glb'))
      .map(pin => [
        TARGET + '/' + pin.key.split('/').map(encodeURIComponent).join('/'), pin,
      ]),
  );
  assert.equal(expected.size, 3);
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
    });
    const requested = [];
    const failures = [];
    await context.route(TARGET + '/**', async route => {
      try {
        const request = route.request();
        const pin = expected.get(request.url());
        assert.ok(pin, 'Browser requested an unpinned Chronicles media object');
        assert.equal(request.method(), 'GET', 'Decode fixture must make GET requests');
        // Upstream is the real public HTTPS response, with the game's
        // staging Origin. Never fabricate the CDN bytes or trust redirects.
        const upstream = await route.fetch({
          headers: { ...request.headers(), origin: ORIGIN, 'accept-encoding': 'identity' },
          maxRedirects: 0, timeout: 35_000,
        });
        const bytes = await upstream.body();
        const headers = upstream.headers();
        validateResponse(pin, {
          status: upstream.status(), headers, body: bytes,
        }, 'GET');
        requested.push(pin.key);
        // Localhost is deliberately not on Cloudflare's production CORS
        // allowlist. Change ONLY CORS after proving the upstream response.
        await route.fulfill({
          status: 200, body: bytes,
          headers: {
            'content-type': headers['content-type'],
            'content-length': String(bytes.length),
            'cache-control': headers['cache-control'],
            'access-control-allow-origin': '*',
          },
        });
      } catch (error) {
        failures.push(String(error?.message || error));
        await route.abort('failed').catch(() => {});
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      await page.waitForFunction(() => window.__chroniclesMediaDecodeReady === true,
        undefined, { timeout: 25_000 });
      // Trusted click: Chromium can initialize its real WebAudio decoder.
      await page.getByRole('button', { name: 'Verify media' }).click();
      await page.waitForFunction(
        () => Boolean(window.__chroniclesMediaDecodeResult || window.__chroniclesMediaDecodeError),
        undefined, { timeout: 100_000 });
      const status = await page.evaluate(() => ({
        result: window.__chroniclesMediaDecodeResult || null,
        error: window.__chroniclesMediaDecodeError || null,
      }));
      assert.deepEqual(failures, [], 'Network and browser errors');
      assert.equal(status.error, null, 'Browser decoding and GLTFLoader must succeed');
      assert.equal(status.result?.tracks?.length, 2, 'Both MP3s must decode');
      for (const track of status.result.tracks) {
        assert.ok(track.seconds > 0, 'MP3 duration must be positive');
        assert.ok(track.sampleRate > 0 && track.channels > 0);
      }
      assert.ok(status.result.meshCount > 0, 'GLTFLoader must recover real geometry');
      assert.equal(requested.length, 3, 'Only two MP3s and one GLB can be fetched');
      assert.deepEqual([...requested].sort(), [...expected.values()].map(pin => pin.key).sort());
      console.log('CHRONICLES_MEDIA_BROWSER_CUTOVER_OK tracks=2 glb_meshes=' +
        status.result.meshCount + ' real_cdn_gets=3');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
