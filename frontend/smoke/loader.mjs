// CI-only visual contract for the actual React loading component (not HTML boot).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/loader.html';
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({
      viewport,
      reducedMotion: viewport.width === 390 ? 'reduce' : 'no-preference',
    });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const loader = page.getByRole('status', { name: 'Cargando Chronicles' });
      await loader.waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForFunction(() =>
        document.querySelector('.chronicles-loading__art.is-ready')?.naturalWidth > 0,
      null, { timeout: 15_000 });
      await page.waitForFunction(() =>
        Number(getComputedStyle(document.querySelector('.chronicles-loading__art')).opacity) > 0.2,
      null, { timeout: 10_000 });
      const measure = await page.evaluate(() => {
        const element = (selector) => document.querySelector(selector)?.getBoundingClientRect();
        const box = (selector) => {
          const b = element(selector);
          return b && { left: b.left, top: b.top, width: b.width, height: b.height };
        };
        return {
          frame: box('.chronicles-loading'), title: box('.chronicles-loading__title'),
          crest: box('.chronicles-loading__crest'), bar: box('.chronicles-loading__track'),
          overflow: document.documentElement.scrollWidth > innerWidth,
          artworkVisible: getComputedStyle(document.querySelector('.chronicles-loading__art')).opacity !== '0',
          crestLoaded: Boolean(document.querySelector('.chronicles-loading__crest')?.naturalWidth),
        };
      });
      const fits = (rect) => rect && rect.width > 0 && rect.height > 0 &&
        rect.left >= -1 && rect.top >= -1 &&
        rect.left + rect.width <= viewport.width + 1 &&
        rect.top + rect.height <= viewport.height + 1;
      assert.ok(!measure.overflow && measure.artworkVisible && measure.crestLoaded, JSON.stringify(measure));
      assert.ok(measure.frame?.width >= viewport.width - 1 &&
        measure.frame?.height >= viewport.height - 1, JSON.stringify(measure));
      for (const rect of [measure.title, measure.crest, measure.bar]) {
        assert.ok(fits(rect), JSON.stringify(measure));
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'smoke-react-loader-' + viewport.width + '.png' });
      console.log('OK   React loading:', viewport.width + 'x' + viewport.height);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}