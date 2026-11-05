// Visual QA of sparse CSS windborne leaves/ash on real Chromium viewports.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/wind-debris.html';
const browser = await chromium.launch();
try {
  for (const [width, height, biome] of [
    [360, 780, 'forest'], [390, 844, 'ash'], [430, 932, 'forest'],
    [844, 390, 'ash'], [1280, 800, 'forest'],
  ]) {
    const coarse = width < 500 || height < 500;
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: coarse, hasTouch: coarse,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(base + '?biome=' + biome + '&coarse=' + coarse, { waitUntil: 'domcontentloaded' });
      const layer = page.locator('.chronicles-wind-debris-layer');
      await layer.waitFor({ state: 'visible', timeout: 10000 });
      const reading = await page.evaluate(() => {
        const layer = document.querySelector('.chronicles-wind-debris-layer');
        const particle = layer.firstElementChild;
        const rect = layer.getBoundingClientRect();
        return {
          type: layer.dataset.kind, width: rect.width, height: rect.height,
          count: layer.childElementCount,
          pointerEvents: getComputedStyle(layer).pointerEvents,
          animation: getComputedStyle(particle).animationName,
          duration: getComputedStyle(particle).animationDuration,
          budget: window.__terraWindDebris.budget,
        };
      });
      assert.equal(reading.type, biome === 'forest' ? 'leaf' : 'ash');
      assert.equal(reading.count, reading.budget);
      assert.equal(reading.count, biome === 'forest' ? (coarse ? 4 : 8) : (coarse ? 5 : 10));
      assert.equal(reading.pointerEvents, 'none');
      assert(reading.animation.includes('chronicles-wind-drift'));
      assert(reading.duration !== '0s', 'Wind flecks must actually animate');
      assert(Math.abs(reading.width - width) < 2 && Math.abs(reading.height - height) < 2);
      const facing = await page.evaluate(() => {
        const layer = document.querySelector('.chronicles-wind-debris-layer');
        const fx = window.__terraWindDebris;
        const first = layer.firstElementChild;
        const initialFlow = layer.dataset.flow;
        fx.setTime(fx.start, (fx.facing + 2) % 4);
        const reversed = layer.dataset.flow;
        const reused = first === layer.firstElementChild;
        const count = layer.childElementCount;
        fx.setTime(fx.start, fx.facing);
        return { initialFlow, reversed, reused, count };
      });
      assert.notEqual(facing.initialFlow, facing.reversed);
      assert.equal(facing.reused, true);
      assert.equal(facing.count, reading.count);
      const gust = await page.evaluate(() => {
        const fx = window.__terraWindDebris;
        const layer = document.querySelector('.chronicles-wind-debris-layer');
        const first = layer.firstElementChild;
        const before = Number.parseFloat(getComputedStyle(first).animationDuration);
        fx.setTime(fx.alternate, fx.facing);
        const after = Number.parseFloat(getComputedStyle(first).animationDuration);
        const reused = first === layer.firstElementChild;
        fx.setTime(fx.start, fx.facing);
        return { before, after, reused, count: layer.childElementCount };
      });
      assert.notEqual(gust.before, gust.after, 'Different wind strengths must alter CSS pace');
      assert.equal(gust.reused, true, 'Wind gusts must not recreate flecks');
      assert.equal(gust.count, reading.count);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'smoke-wind-debris-' + biome + '-' + width + '.png' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await layer.locator('span').first()
        .evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.evaluate(() => {
        const fx = window.__terraWindDebris;
        fx.setTime(fx.disabled, fx.facing);
      });
      await layer.waitFor({ state: 'hidden' });
      assert.equal(await layer.locator('span').count(), 0);
      await page.evaluate(() => {
        const fx = window.__terraWindDebris;
        fx.setTime(fx.start, fx.facing);
      });
      await layer.waitFor({ state: 'visible' });
      await page.evaluate(() => window.__terraWindDebris.setVisible(false));
      await layer.waitFor({ state: 'hidden' });
      await page.evaluate(() => window.__terraWindDebris.setVisible(true));
      await layer.waitFor({ state: 'visible' });
      await page.evaluate(() => window.__terraWindDebris.dispose());
      assert.equal(await layer.count(), 0);
      assert.deepEqual(errors, []);
      console.log('TERRA_WIND_DEBRIS_OK ' + width + 'x' + height + ' ' + biome);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
