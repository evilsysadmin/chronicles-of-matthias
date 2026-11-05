// Actual browser/compositor overlay on mobile, landscape and desktop.
// Captures precipitation, verifies movement reduction and lifecycle cleanup.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/precipitation.html';
const browser = await chromium.launch();
try {
  for (const [width, height, kind] of [
    [360, 780, 'rain'], [390, 844, 'snow'], [430, 932, 'rain'],
    [844, 390, 'rain'], [1280, 800, 'snow'],
  ]) {
    const coarse = width < 500;
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: coarse, hasTouch: coarse,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(base + '?kind=' + kind + '&coarse=' + coarse, { waitUntil: 'domcontentloaded' });
      const layer = page.locator('.chronicles-precipitation-layer');
      await layer.waitFor({ state: 'visible', timeout: 10000 });
      const result = await page.evaluate(() => {
        const layer = document.querySelector('.chronicles-precipitation-layer');
        const span = layer.firstElementChild;
        const rect = layer.getBoundingClientRect();
        return {
          kind: layer.dataset.kind, width: rect.width, height: rect.height,
          count: layer.childElementCount, pointerEvents: getComputedStyle(layer).pointerEvents,
          animation: getComputedStyle(span).animationName,
          budget: window.__terraPrecipitation.budget,
        };
      });
      assert.equal(result.kind, kind);
      assert.equal(result.count, result.budget);
      assert.equal(result.count, kind === 'rain' ? (coarse ? 16 : 36) : (coarse ? 12 : 24));
      assert.equal(result.pointerEvents, 'none');
      assert(result.animation.includes(kind === 'rain' ? 'rainfall' : 'snowfall'));
      assert(Math.abs(result.width - width) < 2 && Math.abs(result.height - height) < 2,
        'Viewport overlay clips incorrectly: ' + JSON.stringify(result));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'smoke-precipitation-' + kind + '-' + width + '.png' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await layer.locator('span').first().evaluate((el) => getComputedStyle(el).animationName), 'none');
      await page.evaluate(() => window.__terraPrecipitation.setTime(window.__terraPrecipitation.clear));
      await layer.waitFor({ state: 'hidden' });
      assert.equal(await layer.locator('span').count(), 0);
      await page.evaluate(() => window.__terraPrecipitation.setTime(window.__terraPrecipitation.start));
      await layer.waitFor({ state: 'visible' });
      await page.evaluate(() => window.__terraPrecipitation.setVisible(false));
      await layer.waitFor({ state: 'hidden' });
      await page.evaluate(() => window.__terraPrecipitation.setVisible(true));
      await layer.waitFor({ state: 'visible' });
      await page.evaluate(() => window.__terraPrecipitation.dispose());
      assert.equal(await layer.count(), 0);
      assert.deepEqual(errors, []);
      console.log('TERRA_PRECIPITATION_OK ' + width + 'x' + height + ' ' + kind);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
