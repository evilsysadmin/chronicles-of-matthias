// CI-only component captures. No fake combat, seeded rewards or backend writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/first-hour-contact.html';
const browser = await chromium.launch();
const failures = [];
try {
  for (const width of [360, 390, 430, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 800 : 844 },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url + '?view=threat', { waitUntil: 'domcontentloaded' });
      const cue = page.locator('[data-chronicles-first-threat]');
      await cue.waitFor({ state: 'visible', timeout: 20000 });
      assert.ok(await page.locator('body').getAttribute('data-enemy-id'),
        'Must use an actual enemy from the road map');
      const info = await page.evaluate(() => {
        const node = document.querySelector('[data-chronicles-first-threat]');
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          overflowing: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.equal(info.overflowing, false);
      assert.ok(info.left >= -1 && info.top >= -1
        && info.right <= width + 1 && info.bottom <= (width === 1280 ? 800 : 844) + 1,
      JSON.stringify(info));
      await page.screenshot({ path: 'smoke-first-threat-' + width + '.png' });
      await page.getByRole('button', { name: 'Entendido' }).click();
      assert.equal(await cue.count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await cue.count(), 0,
        'Dismissal must survive refresh for the same run');

      await page.goto(url + '?view=payment', { waitUntil: 'domcontentloaded' });
      const bark = page.locator('.chronicles-party-bark');
      await bark.waitFor({ state: 'visible', timeout: 20000 });
      const delta = Number(await page.locator('body').getAttribute('data-earned-gold'));
      assert.ok(delta > 0);
      assert.ok((await bark.innerText()).includes(delta + ' monedas de oro'),
        'Visible gold must equal real state delta');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false);
      await page.screenshot({ path: 'smoke-first-payment-' + width + '.png' });
      assert.deepEqual(errors, [], 'No browser errors allowed');
      console.log('OK first-hour real sighting/payment ' + width + 'px');
    } catch (error) {
      failures.push(width + ': ' + error.message);
      console.error('FAIL first-hour visual smoke', width, error);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
