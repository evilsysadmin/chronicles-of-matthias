// Chromium gesture contract against the real MM3 character-sheet fixture.
// Touch opens an inspector; keyboard and mouse keep their established flow.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/character-sheet-desktop.html';
const browser = await chromium.launch();

try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932]]) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      await sheet.waitFor({ state: 'visible' });
      await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' }).click();
      await sheet.getByRole('navigation', { name: 'Apartados de la ficha' })
        .getByRole('button', { name: /Hechizos/ }).click();
      const grimoire = sheet.locator('[data-chronicles-grimoire]');
      const spell = grimoire.locator('[data-grimoire-spell]').first();
      await spell.waitFor({ state: 'visible' });
      const id = await spell.getAttribute('data-grimoire-spell');
      const detail = grimoire.getByRole('dialog', { name: /Examinar/ });
      assert.equal(await detail.isVisible(), false);
      // A real touch tap opens the selected spell, without reaching for the top toolbar.
      await spell.tap();
      await detail.waitFor({ state: 'visible' });
      assert.equal(await spell.getAttribute('aria-pressed'), 'true');
      assert.equal(await detail.locator('[data-spell-icon="' + id + '"]').count(), 1);
      assert.equal(await grimoire.locator('.chronicles-sheet-grimoire__hint-touch').isVisible(), true);
      assert.equal(await grimoire.locator('.chronicles-sheet-grimoire__hint-keyboard').isVisible(), false);
      assert.equal(await grimoire.evaluate((node) => node.scrollWidth > node.clientWidth + 2), false);
      if (width === 390) await page.screenshot({ path: 'smoke-grimoire-touch-inspection-390.png' });
      await detail.getByRole('button', { name: 'Cerrar inspección de hechizo' }).tap();
      assert.equal(await detail.isVisible(), false);
      assert.equal(await spell.evaluate((node) => document.activeElement === node), true,
        'Closing touch inspection must return focus to the tapped spell row');
      // Keyboard activation on a coarse-pointer device still selects: no invented CAST.
      await spell.focus();
      await page.keyboard.press('Enter');
      assert.equal(await detail.isVisible(), false,
        'Keyboard Enter must not impersonate a touch event');
      // The existing toolbar command remains usable and owns its own focus return.
      const inspect = grimoire.getByRole('button', { name: /Examinar/ });
      await inspect.click();
      await detail.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      assert.equal(await detail.isVisible(), false);
      assert.equal(await inspect.evaluate((node) => document.activeElement === node), true);
      assert.deepEqual(errors, [], 'No browser error at ' + width + 'px');
      console.log('CHRONICLES_GRIMOIRE_TOUCH_OK ' + width + 'x' + height);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
