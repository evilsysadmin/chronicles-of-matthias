// Browser visual acceptance of the exact *public* R2 asset through production
// Three.js billboard code. The local Vite fixture needs an explicit CORS
// adaptation; upstream Cloudflare's real staging-Origin CORS is checked first.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const fixture = process.argv[2] || 'http://localhost:4174/smoke/goblin-r2.html';
const asset = 'https://assets.chronicles.shadowops.dpdns.org/sprites/ash-goblin-96ed70aafe94827f.webp';
const staging = 'https://staging.chronicles.shadowops.dpdns.org';
const digest = '96ed70aafe94827f3663228896af612055c9abf12b441a78f7bb4c1fa3b17656';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    let remoteRequests = 0;
    const errors = [];
    await context.route(asset, async (route) => {
      remoteRequests += 1;
      // This is an actual HTTPS response from the R2 custom domain, not
      // synthetic test art. Simulate only the staging Origin to check that
      // Cloudflare allows the real game to use this image.
      const upstream = await route.fetch({
        headers: { ...route.request().headers(), origin: staging },
        timeout: 25_000,
      });
      assert.equal(upstream.status(), 200, 'Public R2 WebP must exist');
      const headers = upstream.headers();
      assert.equal(headers['content-type']?.split(';')[0], 'image/webp');
      assert.ok(['*', staging].includes(headers['access-control-allow-origin']),
        'Public R2 must allow staging-Origin image loads');
      const directives = headers['cache-control']?.toLowerCase().split(',').map((x) => x.trim()) || [];
      assert.ok(directives.includes('public') && directives.includes('immutable')
        && directives.includes('max-age=31536000'), 'Public asset must be truly immutable');
      const bytes = await upstream.body();
      assert.equal(bytes.length, 122882);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
      // Vite fixture runs at localhost, which is deliberately NOT an allowed
      // production CORS origin. Adapt the already-verified response locally.
      await route.fulfill({
        status: 200,
        body: bytes,
        headers: {
          'content-type': 'image/webp',
          'cache-control': headers['cache-control'],
          'access-control-allow-origin': '*',
        },
      });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(fixture, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        document.body.dataset.goblinReady === 'true' || Boolean(document.body.dataset.goblinError),
      undefined, { timeout: 28_000 });
      const data = await page.evaluate(() => ({
        ...document.body.dataset,
        w: document.querySelector('canvas')?.width,
        h: document.querySelector('canvas')?.height,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      await page.screenshot({ path: 'smoke-goblin-r2-' + width + '.png' });
      assert.equal(data.goblinError, undefined, JSON.stringify(data));
      assert.equal(data.goblinReady, 'true');
      assert.equal(data.goblinCount, '3');
      assert.equal(data.goblinFrames, '0,3,5', 'Idle / attack / death must use real distinct cells');
      assert.equal(data.goblinImageWidth, '1536');
      assert.equal(data.goblinImageHeight, '256');
      assert.equal(data.w, width);
      assert.equal(data.h, height);
      assert.equal(data.overflow, false);
      assert.equal(remoteRequests, 1, 'Three goblins must make one R2 atlas request');
      assert.deepEqual(errors, [], 'No browser exceptions');
      console.log('CHRONICLES_GOBLIN_R2_VISUAL_OK viewport=' + width +
        ' poses=idle,attack,dead remoteRequests=1 sha256=' + digest);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
