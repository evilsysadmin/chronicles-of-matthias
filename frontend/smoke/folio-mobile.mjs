// Browser-verified mobile folio contract; screenshots are CI artifacts.
// Uses source components from the real game, not copies of their markup.
// Launches in Chromium against a temporary local Vite server, no user account.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/folio-mobile.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
let failures = 0;

try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390]]) {
    for (const view of ['cast', 'items', 'adventure']) {
      const ctx = await browser.newContext({
        viewport: { width, height }, isMobile: true, hasTouch: true,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      try {
        await page.goto(base + '?view=' + view, { waitUntil: 'networkidle' });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible', timeout: 20_000 });
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
