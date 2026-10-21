// Production adventure-menu DOM + production keyboard resolver, using only
// callback counters: CI never fakes or writes a remote campaign checkpoint.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/adventure-menu-shortcuts.html';
const browser = await chromium.launch();
const failures = [];
const count = async (page, kind) =>
  Number(await page.locator('[data-shortcut-' + kind + '-requests]').innerText());
try {
  for (const width of [360, 390, 430, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 800 : 844 },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const menu = page.getByRole('dialog', { name: 'Menú de aventura' });
      await menu.waitFor({ state: 'visible', timeout: 20000 });
      const bounds = await menu.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
        'Menu must fit viewport: ' + JSON.stringify(bounds));
      assert.match(await menu.innerText(), /Guardar partida · S/);
      assert.match(await menu.innerText(), /Salir sin guardar · Q/);
      assert.equal(await count(page, 'save'), 0);
      assert.equal(await count(page, 'exit'), 0);

      // A real menu key calls the real action binding; no fake persisted save.
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1);
      await page.keyboard.press('q');
      await menu.getByRole('group', { name: 'Confirmar salida sin guardar' }).waitFor({ state: 'visible' });
      assert.equal(await count(page, 'exit'), 1);
      await page.screenshot({ path: 'smoke-menu-shortcuts-confirm-' + width + '.png' });
      // Holding Q or pressing S while the confirmation is open cannot
      // discard the campaign or start a new save.
      await page.keyboard.press('q');
      await page.keyboard.press('s');
      assert.equal(await count(page, 'exit'), 1);
      assert.equal(await count(page, 'save'), 1);
      assert.equal(await count(page, 'discard'), 0);

      // Esc is safe: first cancels the dangerous prompt, second closes menu.
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-confirm]').getAttribute('data-shortcut-confirm'), 'false');
      assert.equal(await menu.getByRole('group', { name: 'Confirmar salida sin guardar' }).count(), 0);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(await count(page, 'discard'), 0);
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1,
        'S outside the menu must NOT invoke save (in-game S remains shooting)');
      await page.locator('[data-shortcut-reopen]').click();
      await menu.waitFor({ state: 'visible' });

      // Editing a field never steals S/Q. Focused audio range controls also
      // keep their own native keyboard behaviour.
      const field = page.getByRole('textbox', { name: 'Campo de texto de prueba' });
      await field.focus();
      await page.keyboard.type('sq');
      assert.equal(await count(page, 'save'), 1);
      assert.equal(await count(page, 'exit'), 1);
      const audioInput = menu.locator('input[type="range"]').first();
      await audioInput.focus();
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1);
      await page.locator('[data-shortcut-busy-toggle]').click();
      await page.keyboard.press('s');
      await page.keyboard.press('q');
      assert.equal(await count(page, 'save'), 1, 'Save busy must block duplicate saves');
      assert.equal(await count(page, 'exit'), 1, 'Save busy must block exits');
      await page.locator('[data-shortcut-busy-toggle]').click();
      await page.keyboard.press('S');
      assert.equal(await count(page, 'save'), 2);
      assert.equal(await count(page, 'discard'), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false, 'Menu must not cause horizontal scrolling');

      await page.screenshot({ path: 'smoke-menu-shortcuts-open-' + width + '.png' });
      assert.deepEqual(errors, []);
      console.log('OK adventure menu shortcuts ' + width + 'px');
    } catch (error) {
      failures.push(width + 'px: ' + error.message);
      console.error('FAIL adventure menu shortcuts', width, error);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
