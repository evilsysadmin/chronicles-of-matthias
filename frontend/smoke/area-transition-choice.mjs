import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/area-transition-choice.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[360,780], [390,844], [430,932], [844,390], [1280,800]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const dialog = page.getByRole('dialog', { name: '¿Viajar al siguiente territorio?' });
      const cancel = page.locator('[data-area-transition-cancel]');
      const accept = page.locator('[data-area-transition-accept]');
      const decision = page.locator('[data-travel-decision]');
      const reopen = page.locator('[data-travel-reopen]');
      const focused = (item) => item.evaluate((node) => document.activeElement === node);
      await dialog.waitFor({ state:'visible' });
      assert.equal(await focused(cancel), true, 'No must be selected by default');
      assert.equal(await dialog.getByText(/UMBRAL/i).count(), 0, 'Obsolete eyebrow must be gone');
      assert.match(await dialog.innerText(), /← \/ → elegir.*Enter confirmar/);
      const rect = await dialog.boundingBox();
      assert.ok(rect && rect.x >= -1 && rect.x + rect.width <= width+1 &&
        rect.y >= -1 && rect.y + rect.height <= height+1, 'Modal must fit screen at '+width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false);

      await page.keyboard.press('Enter');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'no', 'Enter on the default No must cancel');

      await reopen.click();
      await dialog.waitFor({ state:'visible' });
      await page.keyboard.press('ArrowRight');
      assert.equal(await focused(accept), true, 'Right selects Yes');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await focused(cancel), true, 'Left selects No');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'yes', 'Enter on selected Yes must confirm');

      await reopen.click();
      await dialog.waitFor({ state:'visible' });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'no', 'Escape cancels even when Yes focused');

      await reopen.click();
      await dialog.waitFor({ state:'visible' });
      await page.keyboard.press('Tab');
      assert.equal(await focused(accept), true, 'Tab still reaches the other button');
      await page.keyboard.press('Tab');
      assert.equal(await focused(cancel), true, 'Tab must stay within modal');
      await page.keyboard.press('ArrowRight');
      await page.screenshot({ path:'smoke-area-transition-choice-'+width+'.png' });
      await page.keyboard.press('n');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'no', 'Legacy N must still cancel');
      assert.equal(await page.locator('[data-travel-leaked]').innerText(), '0',
        'Navigation/confirmation events must not reach hidden-world keyboard controls');
      assert.deepEqual(errors, []);
      console.log('OK travel arrows/Enter '+width+'px');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
