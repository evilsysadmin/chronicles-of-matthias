// Production information folio, browser layout/focus contract on phones,
// short landscape and desktop. No user account, backend or wall clock.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/world-info.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const phase = width === 430 ? '?phase=night' : width === 390 ? '?fatigue=true' : '';
      await page.goto(base + phase, { waitUntil: 'domcontentloaded' });
      const modal = page.getByRole('dialog', { name: 'INFORMACIÓN DEL JUEGO' });
      await modal.waitFor({ state: 'visible', timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      const bounds = await modal.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const paper = element.querySelector('.chronicles-world-info__paper');
        const pr = paper.getBoundingClientRect();
        return {
          left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          paperWidth: paper.scrollWidth, paperClientWidth: paper.clientWidth,
          paperRight: pr.right,
          scrollWidth: document.documentElement.scrollWidth,
          dialogHeight: r.height,
          closeHeight: element.querySelector('button').getBoundingClientRect().height,
        };
      });
      assert(bounds.left >= -1 && bounds.right <= width + 1 &&
        bounds.top >= -1 && bounds.bottom <= height + 1,
        'World info must fit viewport ' + width + ': ' + JSON.stringify(bounds));
      assert(bounds.paperWidth <= bounds.paperClientWidth + 1 &&
        bounds.scrollWidth <= width + 1, 'No horizontal overflow at ' + width + ': ' + JSON.stringify(bounds));
      assert(bounds.closeHeight >= 44, 'Close touch target too small at ' + width
        + ': ' + JSON.stringify(bounds));
      assert.equal(await modal.locator('[data-chronicles-world-info-time]').innerText(),
        width === 430 ? '22:00' : width === 390 ? '00:00' : '08:00');
      const fatigue = modal.locator('[data-chronicles-fatigue]');
      assert.equal(await fatigue.getAttribute('data-chronicles-fatigue'),
        width === 390 ? 'tired' : 'rested');
      if (width === 390) assert.match(await fatigue.innerText(), /16 h sin dormir.*−2 iniciativa/s);
      const clock = await page.locator('[data-world-time-minutes]').getAttribute('data-world-time-minutes');
      assert.equal(clock, width === 430 ? '1320' : width === 390 ? '1440' : '480');
      assert.deepEqual(errors, [], 'No browser errors at ' + width);
      await page.screenshot({ path: 'smoke-world-info-' + width + '.png' });
      await page.keyboard.press('i');
      await modal.waitFor({ state: 'hidden', timeout: 3000 });
      assert.equal(await page.locator('[data-world-time-minutes]').getAttribute('data-world-time-minutes'), clock,
        'Opening/closing info never spends time');
      console.log('WORLD_INFO_OK ' + width + 'x' + height);
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
