// Actual React quest board, no mocked DOM. Verify immersive viewport, scroll,
// actions and keyboard closing at mobile, landscape and desktop breakpoints.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4174/smoke/notice-board.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    for (const layout of ['single', 'split']) {
      const ctx = await browser.newContext({
        viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(base + '?layout=' + layout, { waitUntil: 'domcontentloaded' });
        const dialog = page.getByRole('dialog', { name: 'Tablón de encargos de Swordhaven' });
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        const geometry = await dialog.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const body = node.querySelector('.chronicles-notice-board__body');
          const close = node.querySelector('[aria-label="Cerrar tablón"]');
          const cr = close.getBoundingClientRect();
          const cs = getComputedStyle(body);
          return {
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            vw: window.innerWidth, vh: window.innerHeight,
            pageScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: body.scrollWidth, bodyClientWidth: body.clientWidth,
            bodyHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight,
            bodyOverflowY: cs.overflowY,
            closeWidth: cr.width, closeHeight: cr.height,
            closeTop: cr.top, closeBottom: cr.bottom,
          };
        });
        assert(Math.abs(geometry.left) <= 1 && Math.abs(geometry.right - geometry.vw) <= 1
          && Math.abs(geometry.top) <= 1 && Math.abs(geometry.bottom - geometry.vh) <= 1,
          'Board must fill viewport at ' + width + ' ' + layout + ': ' + JSON.stringify(geometry));
        assert(geometry.pageScrollWidth <= geometry.vw + 1
          && geometry.bodyScrollWidth <= geometry.bodyClientWidth + 1,
          'Board must not overflow horizontally: ' + JSON.stringify(geometry));
        assert(geometry.bodyOverflowY === 'auto' && geometry.bodyHeight > 80,
          'Only the paper area scrolls: ' + JSON.stringify(geometry));
        assert(geometry.closeWidth >= 44 && geometry.closeHeight >= 44
          && geometry.closeTop >= 0 && geometry.closeBottom <= height + 1,
          'Close button must remain reachable: ' + JSON.stringify(geometry));
        assert.equal(await dialog.locator('[data-chronicles-board-viewport]').getAttribute('data-chronicles-board-viewport'), 'fullscreen');
        assert.equal(await dialog.locator('[data-chronicles-board-layout]').getAttribute('data-chronicles-board-layout'), layout);
        assert.equal(await dialog.locator('[data-chronicles-board-section="other"]').count(), layout === 'split' ? 1 : 0);
        const acceptance = dialog.getByRole('button', { name: 'Aceptar encargo' });
        await acceptance.click();
        assert.equal(await page.locator('[data-board-accepted]').getAttribute('data-board-accepted'), 'true');
        await page.screenshot({ path: 'smoke-notice-board-' + width + '-' + layout + '.png' });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 3000 });
        assert.deepEqual(errors, [], 'No browser errors at ' + width + ' ' + layout);
        console.log('NOTICE_BOARD_FULLSCREEN_OK ' + width + 'x' + height + ' ' + layout);
      } finally { await ctx.close(); }
    }
  }
} finally { await browser.close(); }
