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
      await page.waitForFunction(() =>
        document.activeElement === document.querySelector('details.chronicles-game-menu > summary'));
      assert.equal(await menu.isVisible(), true);
      // Opening from a touch/external control must bring focus into the modal.

      // Modal keyboard navigation must wrap both ways instead of reaching
      // the playable world and its hidden controls behind the folio.
      const details = page.locator('details.chronicles-game-menu');
      await details.evaluate((root) => {
        const visible = Array.from(root.querySelectorAll(
          'summary, button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        )).filter((node) => node.getClientRects().length > 0
          && node.getAttribute('aria-hidden') !== 'true'
          && !node.closest('[hidden], [inert]')
          && getComputedStyle(node).visibility !== 'hidden');
        if (visible.length < 4) throw new Error('Modal has no meaningful keyboard controls');
        visible[0].setAttribute('data-menu-first-focus', '');
        visible[visible.length - 1].setAttribute('data-menu-last-focus', '');
      });
      const firstControl = page.locator('[data-menu-first-focus]');
      const lastControl = page.locator('[data-menu-last-focus]');
      await lastControl.focus();
      await page.keyboard.press('Tab');
      assert.equal(await firstControl.evaluate((node) => document.activeElement === node), true,
        'Tab from last volume slider must wrap to the first menu control, not the game HUD');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await lastControl.evaluate((node) => document.activeElement === node), true,
        'Shift+Tab from the first menu control must wrap to the last');
      // Shift+Tab deliberately leaves focus in the final VOLUME slider.
      // S there belongs to the input, not to Save; restore ordinary menu
      // focus before checking save/quit action routing below.
      await menu.getByRole('button', { name: 'Continuar' }).focus();
      const bounds = await menu.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
        'Menu must fit viewport: ' + JSON.stringify(bounds));
      assert.match(await menu.innerText(), /Guardar partida · S/);
      assert.match(await menu.innerText(), /Salir sin guardar · Q/);
      assert.equal(await count(page, 'save'), 0);
      assert.equal(await count(page, 'exit'), 0);
      // The 1–4 keys must not change the hero invisibly underneath the
      // Save/Quit folio (the party remains Matthias).
      await page.keyboard.press('4');
      assert.equal(await page.locator('[data-shortcut-hero]').getAttribute('data-shortcut-hero'), 'matthias');

      // A real menu key calls the real action binding; no fake persisted save.
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1);
      await page.keyboard.press('q');
      await menu.getByRole('group', { name: 'Confirmar salida sin guardar' }).waitFor({ state: 'visible' });
      // Keyboard focus must land on the SAFE choice, never on the dangerous
      // "Sí, salir" button or on an element removed by the state transition.
      await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Cancelar');
      const dangerousChoice = menu.getByRole('button', { name: 'Sí, salir sin guardar' });
      const safeChoice = menu.getByRole('button', { name: 'Cancelar' });
      await page.keyboard.press('Tab');
      assert.equal(await dangerousChoice.evaluate((node) => document.activeElement === node), true,
        'Tab from Cancel must wrap to the other choice, not leave confirmation');
      await page.keyboard.press('Tab');
      assert.equal(await safeChoice.evaluate((node) => document.activeElement === node), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dangerousChoice.evaluate((node) => document.activeElement === node), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await safeChoice.evaluate((node) => document.activeElement === node), true);
      // The decision must not expose unrelated Save/Continue/Mixer actions,
      // whether by pointer, Tab, or a screen reader.
      assert.equal(await menu.getByRole('button', { name: 'Continuar' }).count(), 0);
      assert.equal(await menu.getByRole('button', { name: 'Guardar partida · S' }).count(), 0);
      assert.equal(await menu.locator('input[type="range"]:visible').count(), 0);
      assert.equal(await menu.getByRole('button', { name: 'Cerrar menú' }).isVisible(), false);
      assert.equal(await menu.locator('[data-confirming-exit]').getAttribute('data-confirming-exit'), 'true');
      assert.equal(await count(page, 'exit'), 1);
      await page.screenshot({ path: 'smoke-menu-shortcuts-confirm-' + width + '.png' });
      // Holding Q or pressing S while the confirmation is open cannot
      // discard the campaign or start a new save.
      await page.keyboard.press('q');
      await page.keyboard.press('s');
      assert.equal(await count(page, 'exit'), 1);
      assert.equal(await count(page, 'save'), 1);
      assert.equal(await count(page, 'discard'), 0);
      await page.keyboard.press('3');
      assert.equal(await page.locator('[data-shortcut-hero]').getAttribute('data-shortcut-hero'), 'matthias',
        'Q confirmation must not silently switch the selected hero');

      // Esc is safe: first cancels the dangerous prompt, second closes menu.
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-confirm]').getAttribute('data-shortcut-confirm'), 'false');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'true',
        'First Escape from Q confirmation must CANCEL only, not dismiss the adventure menu');
      assert.equal(await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc'), '1',
        'The document-level back stack (not just window keydown) must process Escape');
      assert.equal(await menu.getByRole('group', { name: 'Confirmar salida sin guardar' }).count(), 0);
      await menu.getByRole('button', { name: 'Continuar' }).waitFor({ state: 'visible' });
      assert.equal(await menu.locator('input[type="range"]:visible').count() > 0, true,
        'Cancelling restores the unchanged live audio controls');
      await page.waitForFunction(() =>
        document.activeElement?.textContent?.trim() === 'Salir sin guardar · Q');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc'), '2');
      assert.equal(await count(page, 'discard'), 0);
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1,
        'S outside the menu must NOT invoke save (in-game S remains shooting)');
      await page.keyboard.press('4');
      assert.equal(await page.locator('[data-shortcut-hero]').getAttribute('data-shortcut-hero'), 'knight',
        'Outside the menu 4 must still select Faust');
      await page.locator('[data-shortcut-reopen]').click();
      await menu.waitFor({ state: 'visible' });
      await page.keyboard.press('1');
      assert.equal(await page.locator('[data-shortcut-hero]').getAttribute('data-shortcut-hero'), 'knight',
        'After reopening menu, 1 must not silently replace Faust');

      // When the menu is open, no background text input or HUD button may
      // steal focus through Tab or programmatic navigation.
      const field = page.getByRole('textbox', { name: 'Campo de texto de prueba' });
      await field.focus();
      await page.waitForFunction(() =>
        document.activeElement === document.querySelector('details.chronicles-game-menu > summary'));
      assert.equal(await count(page, 'save'), 1);
      assert.equal(await count(page, 'exit'), 1);
      // Inputs that actually belong to the menu still own their key presses.
      const audioInput = menu.locator('input[type="range"]').first();
      await audioInput.focus();
      await page.keyboard.press('s');
      assert.equal(await count(page, 'save'), 1);
      await page.keyboard.press('q');
      assert.equal(await count(page, 'exit'), 1);
      // Esc must still dismiss the adventure menu FROM the volume slider;
      // the opener stays focused and the player can reopen with Enter.
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      const opener = page.locator('.chronicles-game-menu > summary');
      assert.equal(await opener.evaluate((node) => document.activeElement === node), true);
      await page.keyboard.press('Enter');
      await menu.waitFor({ state: 'visible' });
      // The following keys exercise the menu guard, not the slider's native
      // input handling. Move focus back into an ordinary menu button first.
      await menu.getByRole('button', { name: 'Continuar' }).focus();
      // Fixture instrumentation lives behind the modal on small screens,
      // as background controls should. Trigger its DOM control without
      // pretending the player can click through a real modal overlay.
      await page.locator('[data-shortcut-busy-toggle]').evaluate((button) => button.click());
      await page.keyboard.press('s');
      await page.keyboard.press('q');
      assert.equal(await count(page, 'save'), 1, 'Save busy must block duplicate saves');
      assert.equal(await count(page, 'exit'), 1, 'Save busy must block exits');
      // Fixture instrumentation lives behind the modal on small screens,
      // as background controls should. Trigger its DOM control without
      // pretending the player can click through a real modal overlay.
      await page.locator('[data-shortcut-busy-toggle]').evaluate((button) => button.click());
      await menu.getByRole('button', { name: 'Guardar partida · S' }).focus();
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
