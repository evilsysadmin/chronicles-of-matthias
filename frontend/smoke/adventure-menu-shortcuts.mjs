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
      const opener = page.locator('.chronicles-game-menu > summary');
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
      // The feedback folio must remain keyboard/touch usable at 360/390/430px,
      // without spilling outside the viewport or triggering Save/Exit.
      await menu.getByRole('button', { name: /Buzón de feedback/ }).click();
      const mailbox = menu.locator('[data-chronicles-feedback-mailbox]');
      await mailbox.waitFor({ state: 'visible' });
      const feedbackBounds = await mailbox.boundingBox();
      assert.ok(feedbackBounds && feedbackBounds.x >= -1
        && feedbackBounds.x + feedbackBounds.width <= width + 1,
        'Feedback mailbox must fit viewport: ' + JSON.stringify(feedbackBounds));
      const feedbackText = mailbox.getByLabel('Tu mensaje');
      const feedbackCategory = mailbox.getByLabel('¿Sobre qué quieres escribir?');
      await feedbackCategory.selectOption('idea');
      assert.equal(await feedbackCategory.inputValue(), 'idea');
      await feedbackText.fill('Un bug en la taberna del pueblo.');
      assert.equal(await feedbackText.inputValue(), 'Un bug en la taberna del pueblo.');
      // The feedback page owns ALL its keys, even with a button or the
      // outside gem focused. J/G/M cannot switch world views underneath it.
      for (const focused of [
        mailbox.getByRole('button', { name: 'Consultar mis mensajes' }), opener,
      ]) {
        await focused.focus();
        for (const key of ['s', 'q', 'j', 'g', 'm']) await page.keyboard.press(key);
      }
      for (const kind of ['save', 'exit', 'journal', 'status', 'map']) {
        assert.equal(await count(page, kind), 0, kind + ' must stay blocked inside feedback');
      }
      assert.equal(await mailbox.isVisible(), true);
      assert.equal(await feedbackText.inputValue(), 'Un bug en la taberna del pueblo.');

      // Global Escape/Back from the outer summary first returns to the
      // parent folio. It must not close the entire adventure menu.
      await opener.focus();
      await page.keyboard.press('Escape');
      await mailbox.waitFor({ state: 'detached' });
      assert.equal(await menu.isVisible(), true, 'First Esc returns only to parent menu');
      await page.waitForFunction(() =>
        document.activeElement?.hasAttribute('data-chronicles-menu-feedback'));
      await menu.getByRole('button', { name: /Buzón de feedback/ }).click();
      await mailbox.waitFor({ state: 'visible' });
      assert.equal(await feedbackText.inputValue(), 'Un bug en la taberna del pueblo.',
        'Unsent feedback draft must survive a nested Back and re-entry');
      assert.equal(await feedbackCategory.inputValue(), 'idea',
        'Unsent feedback category must survive a nested Back; no silent bug reclassification');

      // Escape from the text field must follow the same one-level Back path.
      await feedbackText.focus();
      await page.keyboard.press('Escape');
      await mailbox.waitFor({ state: 'detached' });
      assert.equal(await menu.isVisible(), true);
      for (const kind of ['save', 'exit', 'journal', 'status', 'map']) {
        assert.equal(await count(page, kind), 0);
      }
      // Even a mouse/touch click on a game HUD button behind this aria-modal
      // menu must not trigger gameplay. Check the real React capture handlers.
      const blocked = await page.evaluate(() => {
        const button = document.querySelector('[data-shortcut-background-action]');
        const pointer = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        button.dispatchEvent(pointer);
        button.dispatchEvent(click);
        return { pointer: pointer.defaultPrevented, click: click.defaultPrevented };
      });
      assert.deepEqual(blocked, { pointer: true, click: true });
      assert.equal(Number(await page.locator('[data-shortcut-background-actions]').innerText()), 0);
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

      // Compare the global Back count relative to the new subpage Back probe.
      // Every document-level Escape must add exactly one, never zero or two.
      const backBeforeConfirm = Number(await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc'));
      // Esc is safe: first cancels the dangerous prompt, second closes menu.
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-confirm]').getAttribute('data-shortcut-confirm'), 'false');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'true',
        'First Escape from Q confirmation must CANCEL only, not dismiss the adventure menu');
      assert.equal(Number(await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')), backBeforeConfirm + 1,
        'The document-level back stack (not just window keydown) must process Escape exactly once');
      assert.equal(await menu.getByRole('group', { name: 'Confirmar salida sin guardar' }).count(), 0);
      await menu.getByRole('button', { name: 'Continuar' }).waitFor({ state: 'visible' });
      assert.equal(await menu.locator('input[type="range"]:visible').count() > 0, true,
        'Cancelling restores the unchanged live audio controls');
      await page.waitForFunction(() =>
        document.activeElement?.textContent?.trim() === 'Salir sin guardar · Q');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(Number(await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')), backBeforeConfirm + 2);
      assert.equal(await count(page, 'discard'), 0);
      assert.equal(await opener.evaluate((node) => document.activeElement === node), false,
        'Esc must RELEASE focus from the closed sapphire, not leave a stale keyboard outline');
      assert.equal(await opener.evaluate((node) => node.matches(':focus-visible')), false,
        'The closed menu gem must not retain its yellow focus-visible ring');

      // Full keyboard round-trip: first Tab opens the menu again, another
      // Escape closes it and returns focus to the expedition.
      await page.keyboard.press('Tab');
      await menu.waitFor({ state: 'visible' });
      assert.equal(await opener.evaluate((node) => document.activeElement === node), true,
        'Tab must re-open and focus the menu after Esc released the gem');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(await opener.evaluate((node) => document.activeElement === node), false);
      // Once the modal closes, the same background button must work normally.
      await page.locator('[data-shortcut-background-action]').dispatchEvent('click');
      assert.equal(Number(await page.locator('[data-shortcut-background-actions]').innerText()), 1);
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
      // Escape from a volume slider must also release its focus, while the
      // next Tab must still reopen the menu from the expedition.
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(await opener.evaluate((node) => document.activeElement === node), false);
      assert.equal(await details.evaluate((node) => node.contains(document.activeElement)), false,
        'No hidden menu input may retain keyboard focus after closing');
      await page.keyboard.press('Tab');
      await menu.waitFor({ state: 'visible' });
      assert.equal(await opener.evaluate((node) => document.activeElement === node), true);
      // The following keys exercise the menu guard, not the slider's native
      // input handling. Move focus back into an ordinary menu button first.
      await menu.getByRole('button', { name: 'Continuar' }).focus();
      // Save-busy is internal fixture state: a blocked background button
      // must never be used to change it while the modal owns pointer input.
      await page.evaluate(() => window.__chroniclesMenuFixture.setSaveBusy(true));
      // A React state setter is not a commit barrier. Do not assert the
      // keyboard guard before the menu actually renders its busy state.
      await page.waitForFunction(() => {
        const save = document.querySelector('[data-chronicles-menu-save]');
        return save?.disabled && save.textContent?.includes('Guardando…');
      });
      await page.keyboard.press('s');
      await page.keyboard.press('q');
      assert.equal(await count(page, 'save'), 1, 'Save busy must block duplicate saves');
      assert.equal(await count(page, 'exit'), 1, 'Save busy must block exits');
      // Save-busy is internal fixture state: a blocked background button
      // must never be used to change it while the modal owns pointer input.
      await page.evaluate(() => window.__chroniclesMenuFixture.setSaveBusy(false));
      // React state setters are asynchronous: wait until the real menu button
      // reflects the completed save before testing keyboard re-entry.
      await page.waitForFunction(() => {
        const save = document.querySelector('[data-chronicles-menu-save]');
        return save && !save.disabled && save.textContent?.includes('Guardar partida · S');
      });
      await menu.getByRole('button', { name: 'Guardar partida · S' }).focus();
      await page.keyboard.press('S');
      await page.waitForFunction(() =>
        Number(document.querySelector('[data-shortcut-save-requests]')?.textContent) === 2);
      assert.equal(await count(page, 'save'), 2);
      assert.equal(await count(page, 'discard'), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false, 'Menu must not cause horizontal scrolling');

      await page.screenshot({ path: 'smoke-menu-shortcuts-open-' + width + '.png' });
      // Native Continue click is another dismissal path: it must not leave
      // the closed menu summary focused after React handles the action.
      await menu.getByRole('button', { name: 'Continuar' }).click();
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      assert.equal(await opener.evaluate((node) => document.activeElement === node), false);
      // The actual group-status dialog consumes bubbling at its React root.
      // Both Escape and G must dismiss only the active modal, even when a
      // hero row owns focus. The parent Back handler must NOT open MENU.
      const groupOpener = page.locator('[data-status-test-open]');
      const group = page.getByRole('dialog', { name: 'ESTADO DEL GRUPO' });
      const globalBeforeStatus = Number(
        await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')
      );
      await groupOpener.click();
      await group.waitFor({ state: 'visible' });
      await group.getByRole('button', { name: 'Cerrar estado del grupo' }).focus();
      await page.keyboard.press('Escape');
      await group.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false',
        'Escape must not open the adventure menu behind party status');
      assert.equal(Number(
        await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')
      ), globalBeforeStatus, 'Only the top modal may consume the Escape event');
      await groupOpener.click();
      await group.waitFor({ state: 'visible' });
      await group.getByRole('row', { name: /Matthias/ }).focus();
      await page.keyboard.press('Escape');
      await group.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      await groupOpener.click();
      await group.waitFor({ state: 'visible' });
      await page.keyboard.press('g');
      await group.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false');
      // This optional guidance window also owns its own keydown events.
      // Escape must close it instead of disappearing into stopped bubbling.
      const hintOpener = page.locator('[data-first-steps-test-open]');
      const hint = page.getByRole('complementary', { name: 'Primeros pasos con Matthias' });
      await hintOpener.click();
      await hint.waitFor({ state: 'visible' });
      await hint.getByRole('button', { name: 'Cerrar primeros pasos' }).focus();
      const beforeHintEscape = Number(
        await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')
      );
      await page.keyboard.press('Escape');
      await hint.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-shortcut-menu-open]').getAttribute('data-shortcut-menu-open'), 'false',
        'ESC closing the help overlay must not resurrect the adventure menu');
      assert.equal(Number(
        await page.locator('[data-shortcut-global-esc]').getAttribute('data-shortcut-global-esc')
      ), beforeHintEscape, 'Only the focused help window may handle its Escape');
      await page.keyboard.press('j');
      assert.equal(await count(page, 'journal'), 1,
        'J must work again after leaving the adventure folio');
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
