// Browser-verified mobile folio contract; screenshots are CI artifacts.
// Uses source components from the real game, not copies of their markup.
// Launches in Chromium against a temporary local Vite server, no user account.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { assertAdventureFolioInk } from './adventure-contrast.mjs';

const base = process.argv[2] || 'http://localhost:4174/smoke/folio-mobile.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
let failures = 0;

try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    for (const view of width === 1280 ? ['healing', 'revive', 'rescue'] : ['cast', 'items', 'adventure', 'healing', 'revive', 'rescue']) {
      const ctx = await browser.newContext({
        viewport: { width, height }, isMobile: true, hasTouch: true,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      try {
        // 27 fixture navigations previously paid Playwright's 500ms networkidle
        // quiet window even after the actual dialog was rendered. Wait for
        // load + the real dialog + paint resources, never a speculative sleep.
        await page.goto(base + '?view=' + view, { waitUntil: 'load' });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible', timeout: 20_000 });
        await page.waitForFunction(() => {
          const visible = [...document.images].filter((img) => img.getClientRects().length);
          return document.fonts.status === 'loaded'
            && visible.every((img) => img.complete && img.naturalWidth > 0);
        }, undefined, { timeout: 15_000 });
        const details = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          const content = d.querySelector('.chronicles-spell-menu__pages')
            || d.querySelector('.chronicles-game-menu__folio-columns');
          const dr = d.getBoundingClientRect();
          const cr = content.getBoundingClientRect();
          return {
            vw: window.innerWidth, vh: window.innerHeight,
            fullWidth: document.documentElement.scrollWidth,
            left: dr.left, right: dr.right, top: dr.top, bottom: dr.bottom,
            contentWidth: content.scrollWidth, contentClient: content.clientWidth,
            contentHeight: cr.height,
          };
        });
        assert(details.left >= -1 && details.right <= details.vw + 1,
          `${view} ${width} dialog escapes viewport: ${JSON.stringify(details)}`);
        assert(details.top >= -1 && details.bottom <= details.vh + 1,
          `${view} ${width} dialog clipped vertically: ${JSON.stringify(details)}`);
        assert(details.fullWidth <= details.vw + 1,
          `${view} ${width} horizontal document overflow: ${JSON.stringify(details)}`);
        assert(details.contentWidth <= details.contentClient + 1,
          `${view} ${width} contents overflow sideways: ${JSON.stringify(details)}`);
        assert(details.contentHeight > 40, `${view} ${width} contents unusable`);
        const buttons = await dialog.locator('button').evaluateAll((all) => all
          .filter((button) => !button.disabled && button.getClientRects().length)
          .map((button) => {
            const rect = button.getBoundingClientRect();
            return { label: button.getAttribute('aria-label') || button.textContent.trim().slice(0,45),
              width:rect.width,height:rect.height };
          }));
        const undersized = buttons.filter((button) => button.height < 39 || button.width < 38);
        assert.deepEqual(undersized, [], `${view} ${width} touch target too small`);
        assert.deepEqual(errors, [], `${view} ${width} browser exceptions`);
        if (view === 'adventure') {
          await assertAdventureFolioInk(dialog, `${width}x${height}`);
          // Expanded sound scrolls a short landscape folio. Reset before
          // saving the canonical open-menu screenshot so it depicts the
          // initial cover/header rather than the last scrolled menu row.
          await dialog.evaluate((element) => { element.scrollTop = 0; });
        }
        await page.screenshot({ path: `smoke-folio-${view}-${width}.png` });
        if(view === 'cast') {
          await dialog.getByRole('tab', { name: /Objetos/ }).click();
          await page.locator('[data-chronicles-use-item="healing-potion"]').waitFor();
          // The original regression appeared only after switching pages
          // with the full items list in 844x390 landscape.
          const changed = await dialog.boundingBox();
          assert(changed.y >= -1 && changed.y + changed.height <= height + 1,
            `CAST→items viewport escape ${width}x${height}: ${JSON.stringify(changed)}`);
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
        }
        if (view === 'healing') {
          await dialog.locator('[data-chronicles-cast="first-aid"]').click();
          const picker = dialog.locator('[data-chronicles-heal-picker="first-aid"]');
          await picker.waitFor({ state: 'visible' });
          const fallen = picker.locator('[data-chronicles-heal-target="rook"]');
          const wounded = picker.locator('[data-chronicles-heal-target="matthias"]');
          assert.equal(await fallen.isDisabled(), true, '0 PV must not be curable');
          assert.equal(await wounded.isEnabled(), true, 'Living wounded ally must be a valid target');
          assert.match(await picker.innerText(), /Elixir de retorno/);
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Choosing a spell alone must not spend a turn or cast');
          const fit = await picker.evaluate((node) => ({
            width: node.scrollWidth, clientWidth: node.clientWidth,
          }));
          assert(fit.width <= fit.clientWidth + 2,
            'Healing targets overflow the grimoire: ' + JSON.stringify(fit));
          await page.screenshot({ path: `smoke-folio-healing-targets-${width}.png` });
          await wounded.click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'cast:first-aid:matthias');
          assert.equal((await page.locator('[data-test-result]').textContent()).trim(),
            'cast:first-aid:matthias');
        }
        if (view === 'revive') {
          await dialog.locator('[data-chronicles-use-item="revive-draught"]').click();
          const picker = dialog.locator('[data-chronicles-revive-picker="revive-draught"]');
          await picker.waitFor({ state: 'visible' });
          const fallen = picker.locator('[data-chronicles-revive-target="rook"]');
          const living = picker.locator('[data-chronicles-revive-target="matthias"]');
          assert.equal(await fallen.isEnabled(), true, '0 PV ally must be eligible for revival');
          assert.equal(await living.isDisabled(), true, 'living ally cannot consume revival elixir');
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Opening the revive picker must not consume an elixir');
          const fit = await picker.evaluate((node) => ({
            width: node.scrollWidth, clientWidth: node.clientWidth,
          }));
          assert(fit.width <= fit.clientWidth + 2,
            'Revive picker overflows: ' + JSON.stringify(fit));
          await page.screenshot({ path: `smoke-folio-revive-targets-${width}.png` });
          await fallen.click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'use:revive-draught:rook');
          assert.equal((await page.locator('[data-test-result]').textContent()).trim(),
            'use:revive-draught:rook');
        }
        if (view === 'rescue') {
          await dialog.locator('[data-chronicles-cast="first-aid"]').click();
          const healPicker = dialog.locator('[data-chronicles-heal-picker="first-aid"]');
          await healPicker.waitFor({ state: 'visible' });
          assert.match(await healPicker.innerText(), /Llevas 1 Elixir de retorno/);
          await healPicker.locator('[data-chronicles-open-revive]').click();
          const revivePicker = dialog.locator('[data-chronicles-revive-picker="revive-draught"]');
          await revivePicker.waitFor({ state: 'visible' });
          assert.equal(await dialog.getAttribute('data-chronicles-menu-tab'), 'items');
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Switching from healing to revival cannot spend items or turn');
          await page.screenshot({ path: `smoke-folio-healing-to-revive-${width}.png` });
          await revivePicker.locator('[data-chronicles-revive-target="rook"]').click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'use:revive-draught:rook');
        }
        if(view === 'adventure') {
          await dialog.getByRole('button', { name: 'Salir sin guardar' }).click();
          await dialog.getByRole('group', { name: 'Confirmar salida sin guardar' }).waitFor();
          await dialog.getByRole('button', { name: 'Cancelar' }).click();
          await dialog.getByRole('group', { name: 'Confirmar salida sin guardar' })
            .waitFor({ state: 'hidden' });
        }
        console.log(`FOLIO_VIEWPORT_OK view=${view} width=${width} height=${height}`);
      } catch (error) {
        failures++;
        console.log(`FOLIO_VIEWPORT_FAIL view=${view} width=${width}: ${error.message}`);
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
