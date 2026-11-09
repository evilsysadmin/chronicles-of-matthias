// Inspect the actual Grupo (G) modal with production CSS and state-derived
// PV/PH/CA. Mobile rows must remain readable, not merely fit in seven columns.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

export async function runQuickStatusMobileSmoke(base = 'http://localhost:4174/smoke/quick-status-mobile.html') {
  const browser = await chromium.launch();
  try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    const touch = width <= 430;
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: touch, hasTouch: touch,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const dialog = page.getByRole('dialog', { name: 'ESTADO DEL GRUPO' });
      await dialog.waitFor({ state: 'visible', timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      const result = await dialog.evaluate(modal => {
        const get = el => {
          const r = el.getBoundingClientRect();
          return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
        };
        const list = modal.querySelector('.chronicles-quick-status__table');
        const rows = [...list.querySelectorAll('.chronicles-quick-status__row')];
        return {
          viewport: { width: innerWidth, height: innerHeight },
          dialog: get(modal),
          close: get(modal.querySelector('.chronicles-quick-status__close')),
          docWidth: document.documentElement.scrollWidth,
          tableOverflows: list.scrollWidth > list.clientWidth + 1,
          headerVisible: getComputedStyle(list.querySelector('.is-head')).display !== 'none',
          rows: rows.map(row => {
            const name = row.querySelector('.is-name b');
            const stats = ['is-hp', 'is-sp', 'is-ac'].map(className => {
              const item = row.querySelector('.' + className);
              return { label: getComputedStyle(item, '::before').content,
                text: item.textContent.trim(), font: parseFloat(getComputedStyle(item).fontSize),
                clipped: item.scrollWidth > item.clientWidth + 1,
                rect: get(item) };
            });
            return {
              rect: get(row), name: name.textContent.trim(),
              nameFont: parseFloat(getComputedStyle(name).fontSize),
              nameClipped: name.scrollWidth > name.clientWidth + 1,
              state: row.querySelector('.is-condition').textContent.trim(),
              stateFont: parseFloat(getComputedStyle(row.querySelector('.is-condition')).fontSize),
              stats,
              weaponVisible: getComputedStyle(row.querySelector('.is-weapon')).display !== 'none',
              accessible: row.getAttribute('aria-label'),
            };
          }),
        };
      });
      const compact = width <= 640 || height <= 480;
      const reason = width + 'x' + height + ': ' + JSON.stringify(result);
      assert(result.dialog.left >= -1 && result.dialog.right <= width + 1
        && result.dialog.top >= -1 && result.dialog.bottom <= height + 1,
      'Grupo modal escapes the viewport ' + reason);
      assert(result.docWidth <= width + 1 && !result.tableOverflows,
        'Grupo content scrolls sideways ' + reason);
      // The existing desktop X is intentionally 40px; only touch/short
      // landscape needs the new 44px minimum.
      const minClose = compact ? 44 : 40;
      assert(result.close.height >= minClose && result.close.width >= minClose,
        'Close button too small for this layout ' + reason);
      assert.equal(result.rows.length, 4, reason);
      assert.deepEqual(result.rows.map(row => row.name).sort(),
        ['Aziz', 'Faust', 'Hildegard', 'Matthias'].sort(), reason);
      for (const row of result.rows) {
        assert(row.rect.left >= result.dialog.left - 1 && row.rect.right <= result.dialog.right + 1,
          'Hero must fit inside status folio ' + reason);
        assert.match(row.accessible, /PV, .* PH|PV, sin PH/);
        assert.match(row.accessible, /CA \d+, estado .*Abrir ficha/);
        if (compact) {
          assert(row.rect.height >= 80 && row.nameFont >= 16 && row.stateFont >= 14
            && !row.nameClipped && !row.weaponVisible,
          'Mobile hero header unreadable ' + reason);
          assert.deepEqual(row.stats.map(stat => stat.label), ['"PV"', '"PH"', '"CA"'], reason);
          assert(row.stats.every(stat => stat.font >= 16 && !stat.clipped
            && stat.rect.left >= row.rect.left - 1
            && stat.rect.right <= row.rect.right + 1), 'PV/PH/CA clipped ' + reason);
        } else assert(row.weaponVisible && result.headerVisible, 'Desktop columns disappeared ' + reason);
      }
      if (compact) assert.equal(result.headerVisible, false, reason);
      await page.screenshot({ path: 'smoke-quick-status-readable-' + width + '.png' });
      // The full card is still an interactive row, with zero game mutations.
      await dialog.locator('.chronicles-quick-status__row').nth(1).click();
      const opened = await page.locator('[data-chronicles-open-sheet]').getAttribute('data-chronicles-open-sheet');
      assert.ok(opened && opened !== 'matthias', 'Click must target the chosen real hero ' + reason);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 3000 });
      assert.deepEqual(errors, [], 'Browser errors ' + reason);
      console.log('CHRONICLES_QUICK_STATUS_READABLE_OK', width + 'x' + height);
    } finally { await context.close(); }
  }
  } finally { await browser.close(); }
}
