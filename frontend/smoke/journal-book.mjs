// Real React journal smoke: no backend credentials or debug routes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:4174/smoke/journal-book.html';
const sizes = [[390, 844], [844, 390], [1280, 800]];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: width <= 844,
      hasTouch: width <= 844, deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const dialog = page.getByRole('dialog', { name: /Crónica de expedición/ });
      await dialog.waitFor({ state: 'visible' });
      const tabQuests = dialog.getByRole('tab', { name: /Encargos/ });
      const tabMemories = dialog.getByRole('tab', { name: /Memorias/ });
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'false');
      assert.equal(await dialog.getByRole('tabpanel').count(), 1,
        'Journal should show one chapter at a time, not a two-panel dashboard');
      const first = dialog.locator('[data-chronicles-quest-id="banner-contract"]');
      assert.equal(await first.locator('button').getAttribute('aria-expanded'), 'true');
      assert.match(await first.innerText(), /Camino de los Estandartes/);
      assert.match(await first.innerText(), /mojón sin nombre/);
      const second = dialog.locator('[data-chronicles-quest-id="names-in-wood"]');
      assert.match(await second.innerText(), /Rookwood/);
      await second.locator('button').click();
      assert.equal(await second.locator('button').getAttribute('aria-expanded'), 'true');
      assert.equal(await first.locator('button').getAttribute('aria-expanded'), 'false');
      assert.match(await second.innerText(), /Roble del Claro/);
      const completed = dialog.locator('[data-chronicles-quest-id="road-bandits"]');
      assert.match(await completed.innerText(), /Resuelto/);
      assert.doesNotMatch(await completed.innerText(), /PISTA DEL LUGAR/);
      await page.screenshot({ path: 'smoke-journal-quests-' + width + '.png' });
      const size = await page.evaluate(() => {
        const rect = document.querySelector('.chronicles-journal-modal').getBoundingClientRect();
        return { documentWidth: document.documentElement.scrollWidth,
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          overflow: document.body.style.overflow };
      });
      assert(size.documentWidth <= width + 1, 'Journal overflows viewport width');
      assert(size.left >= -1 && size.right <= width + 1
        && size.top >= -1 && size.bottom <= height + 1, 'Journal escapes viewport');
      assert.equal(size.overflow, 'hidden', 'Journal should lock world scrolling');
      await tabMemories.click();
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'true');
      await dialog.getByText('Primera jornada').waitFor();
      await dialog.getByText('El viento sopló desde el bosque.').waitFor();
      await page.screenshot({ path: 'smoke-journal-memories-' + width + '.png' });
      await tabQuests.click();
      assert.equal(await second.locator('button').getAttribute('aria-expanded'), 'true',
        'Switching back must retain the reader’s selected entry');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), '',
        'Closing journal must restore scrolling');
      assert.deepEqual(errors, [], 'Browser errors while reading journal');
      console.log('CHRONICLES_JOURNAL_BOOK_OK ' + width + 'x' + height);
    } catch (error) {
      failures++;
      console.error('CHRONICLES_JOURNAL_BOOK_FAIL ' + width + 'x' + height + ': ' + (error.stack || error));
      await page.screenshot({ path: 'smoke-journal-FAIL-' + width + '.png' }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
