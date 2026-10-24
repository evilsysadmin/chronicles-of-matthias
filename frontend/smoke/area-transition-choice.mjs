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
      assert.equal(await cancel.innerText(), 'No', 'Choices must not imply Enter always means Yes');
      assert.equal(await accept.innerText(), 'Sí', 'Keyboard guidance belongs in the shared hint');
      const background = (item) => item.evaluate((node) => getComputedStyle(node).backgroundColor);
      assert.notEqual(await background(cancel), await background(accept),
        'Safe No must be the only visibly selected action at first paint');
      assert.equal(await dialog.getByText(/UMBRAL/i).count(), 0, 'Obsolete eyebrow must be gone');
      assert.match(await dialog.innerText(), /← \/ → elegir.*Enter confirmar/);
      const rect = await dialog.boundingBox();
      assert.ok(rect && rect.x >= -1 && rect.x + rect.width <= width+1 &&
        rect.y >= -1 && rect.y + rect.height <= height+1, 'Modal must fit screen at '+width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false);

      // S is the game's shoot hotkey, never a secret Yes/enter-area alias.
      // Neither ranged/melee nor vertical movement reaches the world while
      // this confirmation owns focus.
      for (const key of ['s', 'S', 'a', 'ArrowUp', 'ArrowDown']) {
        await page.keyboard.press(key);
        assert.equal(await dialog.isVisible(), true, key + ' must not accept or dismiss travel');
        assert.equal(await focused(cancel), true, key + ' must preserve safe No selection');
      }
      assert.equal(await page.locator('[data-travel-leaked]').innerText(), '0',
        'Combat/movement keys must not reach the underlying expedition');
      await page.keyboard.press('Enter');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'no', 'Enter on the default No must cancel');

      await reopen.click();
      await dialog.waitFor({ state:'visible' });
      await page.keyboard.press('ArrowRight');
      assert.equal(await focused(accept), true, 'Right selects Yes');
      assert.notEqual(await background(accept), await background(cancel),
        'Gold selection must follow right-arrow focus to Yes');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await focused(cancel), true, 'Left selects No');
      assert.notEqual(await background(cancel), await background(accept),
        'Gold selection must return to No on left-arrow');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('s');
      assert.equal(await dialog.isVisible(), true,
        'Shoot S must never enter the selected destination even when Yes is focused');
      assert.equal(await focused(accept), true, 'S must not change the selected option');
      await page.keyboard.press('Enter');
      await dialog.waitFor({ state:'hidden' });
      assert.equal(await decision.innerText(), 'yes', 'Only Enter on selected Yes confirms');

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
