// Shop-specific Chromium regression smoke: real React component + real reducer,
// no production-only debug routes or staging login requirements.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/shop-room.html';
// Preserve the real 1909×900 staging screenshot layout as an explicit
// contract: all eleven items should fit in a single glance on wide desktop.
const views = [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800], [1440, 900], [1740, 864], [1909, 900]];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;

// Wait for the actual React dialog, fonts and visible artwork instead of
// paying Playwright's 500ms network-idle quiet window on every merchant scene.
async function gotoReadyShop(page, target) {
  await page.goto(target, { waitUntil: 'load' });
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const images = [...document.images].filter((img) => img.getClientRects().length);
    return document.fonts.status === 'loaded'
      && images.every((img) => img.dataset.chroniclesShopArtLayer === 'premium'
        || (img.complete && img.naturalWidth > 0));
      // Optional R2 premium overlays must not block the bundled fallback:
      // all other visible images and fonts still have to finish loading.
  }, undefined, { timeout: 20_000 });
  await page.locator('[data-chronicles-interior-loading]').waitFor({ state: 'detached', timeout: 16_000 });
}

async function catalogFilterTops(dialog) {
  return dialog.locator('.chronicles-shop__filters label').evaluateAll(
    (labels) => labels.map((label) => label.getBoundingClientRect().top),
  );
}

// Regression for 844×390: opening comparison must never push checkout below
// the touch viewport. Test viewport geometry, not just display/DOM existence.
async function assertLandscapeCheckoutVisible(dialog, label) {
  const layout = await dialog.locator('.chronicles-shop__primary').evaluate((button) => {
    const detail = button.closest('.chronicles-shop__detail');
    const rect = button.getBoundingClientRect();
    const panel = detail.getBoundingClientRect();
    return {
      buttonTop: rect.top, buttonBottom: rect.bottom,
      panelTop: panel.top, panelBottom: panel.bottom,
      viewport: window.innerHeight,
      height: rect.height,
      visible: getComputedStyle(button).visibility === 'visible',
    };
  });
  assert(layout.visible && layout.height >= 38 && layout.buttonTop >= layout.panelTop - 1
      && layout.buttonBottom <= layout.panelBottom + 1
      && layout.buttonBottom <= layout.viewport - 2,
    label + ': purchase action clipped under the expanded comparison: ' + JSON.stringify(layout));
}

// Capture the true room composition without React panels for art direction.
// Temporary QA stylesheet is always removed before asserting interactions.
async function captureArtworkOnly(page, filename) {
  const mask = await page.addStyleTag({ content: `
    .chronicles-shop__head, .chronicles-shop__tabs, .chronicles-shop__market,
    .chronicles-shop__foot, .chronicles-guild__membership, .chronicles-guild__spells,
    .chronicles-shop__art-space, .chronicles-guild__art-space { visibility: hidden !important; }
    .chronicles-shop::before, .chronicles-shop::after { display: none !important; }
  ` });
  try {
    await page.screenshot({ path: filename });
  } finally {
    await mask.evaluate((node) => node.remove());
  }
}


try {
  for (const [width, height] of views) {
    const mobile = width <= 844;
    const context = await browser.newContext({
      viewport: { width, height }, hasTouch: mobile, isMobile: mobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await gotoReadyShop(page, url);
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 20_000 });
      const image = page.locator('.chronicles-shop__scene img');
      await image.waitFor();
      await page.waitForFunction(() => {
        const img = document.querySelector('.chronicles-shop__scene img');
        return Boolean(img?.complete && img.naturalWidth);
      });
      const art = await image.evaluate((img) => ({
        w: img.naturalWidth, h: img.naturalHeight, src: img.currentSrc,
      }));
      assert.equal(art.w, 1672, `Wrong Brunna art ${width}px: ${JSON.stringify(art)}`);
      assert.equal(art.h, 941);
      assert.match(art.src, /brunna-forge\.webp/);

      const boxes = await page.evaluate(() => {
        const rect = (sel) => {
          const r = document.querySelector(sel).getBoundingClientRect();
          return { left:r.left, right:r.right, top:r.top, bottom:r.bottom,
            width:r.width, height:r.height };
        };
        return {
          docWidth: document.documentElement.scrollWidth,
          bodyOverflow: document.body.style.overflow,
          viewport: { width:window.innerWidth, height:window.innerHeight },
          dialog: rect('.chronicles-shop'),
          catalog: rect('.chronicles-shop__catalog'),
          detail: rect('.chronicles-shop__detail'),
          scene: rect('.chronicles-shop__scene'),
          list: rect('.chronicles-shop__list'),
          market: rect('.chronicles-shop__market'),
        };
      });
      assert.equal(boxes.bodyOverflow, 'hidden', 'Shop must block game scrolling');
      assert(boxes.docWidth <= width + 1,
        `Shop document overflows horizontally at ${width}px: ${JSON.stringify(boxes)}`);
      assert(boxes.dialog.left >= -1 && boxes.dialog.right <= width + 1
        && boxes.dialog.top >= -1 && boxes.dialog.bottom <= height + 1,
      `Fullscreen shop escapes viewport at ${width}px: ${JSON.stringify(boxes)}`);
      if (width >= 1280 && height >= 700) {
        assert(boxes.detail.width <= width * .29,
          'A compact purchase receipt should not eclipse Brunna: ' + JSON.stringify(boxes));
        assert(boxes.detail.top >= height * .30,
          'The receipt should sit lower than Brunna’s face: ' + JSON.stringify(boxes));
      }
      const portraitPhone = width <= 900 && height > width;
      if (portraitPhone) {
        // Inspect computed hit boxes in Chromium: a visible 35px close icon
        // used to be too small to tap reliably on 360–430px phones.
        const controls = await dialog.evaluate((root) => {
          const size = (element) => {
            const { width: w, height: h } = element.getBoundingClientRect();
            return { width: w, height: h };
          };
          return {
            close: size(root.querySelector('.chronicles-shop__close')),
            tabs: [...root.querySelectorAll('.chronicles-shop__tabs button')].map(size),
          };
        });
        assert(controls.close.width >= 44 && controls.close.height >= 44,
          'Portrait close control must be thumb-sized: ' + JSON.stringify(controls));
        assert(controls.tabs.every(({ width: w, height: h }) => w >= 44 && h >= 44),
          'Portrait buy/sell tabs must remain thumb-sized: ' + JSON.stringify(controls));
      }
      assert(boxes.catalog.width > 240 && (portraitPhone ? boxes.detail.width === 0 : boxes.detail.width > 240),
        `Unusable shop panels at ${width}px: ${JSON.stringify(boxes)}`);
      if (portraitPhone) {
        assert(boxes.list.height > height * .35,
          `Portrait must dedicate most available room to stock: ${JSON.stringify(boxes)}`);
        assert(boxes.catalog.bottom <= height + 1,
          `Portrait stock escapes viewport: ${JSON.stringify(boxes)}`);
      }
      if (width > 900) {
        assert(boxes.catalog.right + 25 < boxes.detail.left,
          `Brunna scene is squeezed between panels at ${width}px: ${JSON.stringify(boxes)}`);
        assert(boxes.catalog.bottom <= height + 1 && boxes.detail.bottom <= height + 1,
          `Desktop pane exceeds viewport: ${JSON.stringify(boxes)}`);
      } else {
        assert(boxes.market.width <= width + 1,
          `Mobile scroll pane spills horizontally: ${JSON.stringify(boxes)}`);
        if (width >= 700 && height <= 500) {
          assert(boxes.catalog.top < height * 0.48 && boxes.detail.top < height * 0.48,
            `Landscape market is hidden below an empty art band: ${JSON.stringify(boxes)}`);
          assert(boxes.detail.left - boxes.catalog.right >= 5
              && boxes.detail.left - boxes.catalog.right <= 15,
            `Landscape must use adjacent, stock-first panes: ${JSON.stringify(boxes)}`);
          assert(boxes.catalog.width > boxes.detail.width,
            `Landscape inventory must be wider than checkout: ${JSON.stringify(boxes)}`);
          assert(boxes.list.height > 115,
            `Landscape stock cannot scroll enough offers: ${JSON.stringify(boxes)}`);
          const ledger = await dialog.locator('.chronicles-shop__list').evaluate((list) => {
            const bounds = list.getBoundingClientRect();
            const items = [...list.querySelectorAll('[data-chronicles-shop-item]')];
            return {
              columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
              visible: items.filter((item) => {
                const r = item.getBoundingClientRect();
                return r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
              }).length,
              total: items.length,
              firstHeight: items[0]?.getBoundingClientRect().height,
            };
          });
          assert.equal(ledger.columns, 2,
            'Landscape stock must use two actual grid columns: ' + JSON.stringify(ledger));
          assert(ledger.visible >= 7 && ledger.firstHeight >= 44,
            'Landscape should expose at least seven touch-size merchandise rows at once: ' + JSON.stringify(ledger));
          const filterTops = await catalogFilterTops(dialog);
          assert(filterTops.every((top) => Math.abs(top - filterTops[0]) < 2),
            `Landscape filters must fit a single row: ${filterTops}`);
          assert(boxes.catalog.bottom <= height + 1 && boxes.detail.bottom <= height + 1,
            `Landscape panels escape viewport: ${JSON.stringify(boxes)}`);
        }
      }
      if (width >= 1280 && height >= 800) {
        const ledger = await dialog.locator('.chronicles-shop__catalog').evaluate((catalog) => {
          const list = catalog.querySelector('.chronicles-shop__list');
          const rows = [...list.querySelectorAll('[data-chronicles-shop-item]')];
          const last = rows.at(-1)?.getBoundingClientRect();
          const rect = list.getBoundingClientRect();
          const filters = catalog.querySelector('.chronicles-shop__filters');
          const filterRows = [...filters.children].map((label) => label.getBoundingClientRect());
          return { rows: rows.length, clientHeight: list.clientHeight,
            scrollHeight: list.scrollHeight, lastBottom: last?.bottom, visibleBottom: rect.bottom,
            rowHeight: rows[0]?.getBoundingClientRect().height,
            filtersInOneRow: filterRows.length === 3 && filterRows.every((r) => Math.abs(r.top - filterRows[0].top) <= 2) };
        });
        assert.equal(ledger.rows, 11, 'Brunna baseline must retain its complete eleven-item catalogue');
        assert(ledger.filtersInOneRow,
          'Desktop shop still uses the obsolete two-row filters at ' + width + 'x' + height + ': ' + JSON.stringify(ledger));
        assert(ledger.scrollHeight <= ledger.clientHeight + 2,
          'All eleven merchant items should fit without scrolling at ' + width + 'x' + height + ': ' + JSON.stringify(ledger));
        assert(ledger.lastBottom <= ledger.visibleBottom + 1,
          'The final merchandise item is clipped: ' + JSON.stringify(ledger));
        assert(ledger.rowHeight >= 35,
          'The dense layout must keep usable desktop row targets: ' + JSON.stringify(ledger));
      }
      await page.screenshot({ path: `smoke-shop-${width}.png` });
      if (width === 390 || width === 1280) {
        await captureArtworkOnly(page, 'smoke-shop-art-only-brunna-' + width + '.png');
      }

      // Longbows are real missile weapons, never generic potion-like items.
      const longbow = dialog.locator('[data-chronicles-shop-item="wooden-longbow"]');
      assert.match(await longbow.innerText(), /Armas a distancia/);
      const paintedLongbow = longbow.locator('img[data-chronicles-shop-art="wooden-longbow"]');
      await paintedLongbow.waitFor({ state: 'visible' });
      assert.equal(await paintedLongbow.getAttribute('alt'), 'Arco largo de madera');
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-chronicles-shop-item="wooden-longbow"] img');
        return node?.complete && node.naturalWidth >= 512 && node.naturalHeight >= 512;
      });
      const paintedDagger = dialog.locator('[data-chronicles-shop-item="brass-dagger"] img[data-chronicles-shop-art="brass-dagger"]');
      await paintedDagger.waitFor({ state: 'visible' });
      assert.equal(await paintedDagger.getAttribute('alt'), 'Daga de latón',
        'Dagger must use the correct material-specific accessible portrait');
      await page.waitForFunction(() => {
        const image = document.querySelector('[data-chronicles-shop-item="brass-dagger"] img');
        return image?.complete && image.naturalWidth >= 512 && image.naturalHeight >= 512;
      });
      const missingArt = dialog.locator('[data-chronicles-shop-item="wooden-staff"] svg');
      assert.equal(await missingArt.getAttribute('aria-label'), 'Arma',
        'Unpainted weapons must retain the accessible fallback glyph');
      const spriteGeometry = !portraitPhone && await dialog.evaluate((root) => {
        const portrait = root.querySelector('.chronicles-shop__item-portrait');
        const sprite = portrait?.querySelector('img[data-chronicles-shop-art="wooden-longbow"]');
        if (!portrait || !sprite) return null;
        const p = portrait.getBoundingClientRect();
        const s = sprite.getBoundingClientRect();
        return { parent: { left:p.left, right:p.right, top:p.top, bottom:p.bottom },
          image: { left:s.left, right:s.right, top:s.top, bottom:s.bottom } };
      });
      if (!portraitPhone) {
        assert(spriteGeometry, 'Selected longbow must display its own detailed sprite');
        assert(spriteGeometry.image.left >= spriteGeometry.parent.left - 1
          && spriteGeometry.image.right <= spriteGeometry.parent.right + 1
          && spriteGeometry.image.top >= spriteGeometry.parent.top - 1
          && spriteGeometry.image.bottom <= spriteGeometry.parent.bottom + 1,
          'Weapon portrait must stay inside its own panel: ' + JSON.stringify(spriteGeometry));
      }

      // Filtering, sorting and selection must only alter presentation.
      const catalog = dialog.locator('.chronicles-shop__catalog');
      await catalog.getByRole('searchbox', { name: 'Buscar mercancía' }).fill('daga');
      const dagger = dialog.locator('[data-chronicles-shop-item="brass-dagger"]');
      await dagger.waitFor({ state: 'visible' });
      assert.equal(await catalog.locator('[data-chronicles-shop-item]').count(), 1,
        `Shop name filter failed at ${width}px`);
      await catalog.getByRole('searchbox', { name: 'Buscar mercancía' }).fill('');
      await catalog.getByLabel('Orden').selectOption('price-desc');
      assert((await catalog.locator('[data-chronicles-shop-item]').count()) >= 6);
      await catalog.getByLabel('Orden').selectOption('name');
      await dagger.locator('button').click();
      const detail = dialog.locator('.chronicles-shop__detail');
      await detail.getByRole('heading', { name: 'Daga de latón' }).waitFor();
      // The exact same combat comparison is now discoverable on stock
      // hover/focus, without creating a second dashboard over the merchant.
      if (width > 900) await dagger.locator('button').hover();
      if (width <= 900) {
        const comparison = detail.locator('.chronicles-shop__mobile-preview');
        await comparison.locator('[data-chronicles-shop-party-comparison]').waitFor({ state: 'visible' });
        assert.equal(await dagger.locator('.chronicles-shop__gear-peek').count(), 0,
          'Touch preview must not expand rows and steal inventory space');
      }
      const peek = width <= 900
        ? detail.locator('.chronicles-shop__mobile-preview .chronicles-shop__gear-peek')
        : width >= 1180 && height >= 540
          ? dialog.locator('.chronicles-shop__peek-stage .chronicles-shop__gear-peek')
          : dagger.locator('.chronicles-shop__gear-peek');
      await peek.waitFor({ state: 'visible' });
      const rows = await peek.locator('.chronicles-shop__gear-peek-member').count();
      if (width <= 900) {
        assert.equal(rows, 4, 'Touch comparison must show every hero separately');
        for (const name of ['Matthias', 'Hildegard', 'Aziz', 'Faust']) {
          assert((await peek.innerText()).includes(name),
            'Touch comparison lost ' + name);
        }
      } else assert.equal(rows, 4, 'Desktop must keep its four per-hero comparisons');
      assert.match(await peek.innerText(), /Matthias/);
      assert.match(await peek.innerText(), /Daño|Acierto|Alcance|No puede equiparlo|Sin cambios/);
      if (width === 844) await assertLandscapeCheckoutVisible(dialog, 'Brunna per-hero gear preview');
      if (width >= 1180 && height >= 540) {
        const position = await peek.evaluate((el) => {
          const rect = (node) => {
            const r = node.getBoundingClientRect();
            return { left: r.left, right: r.right, width: r.width };
          };
          const market = el.closest('.chronicles-shop__market');
          return { peek: rect(el), catalog: rect(market.querySelector('.chronicles-shop__catalog')),
            detail: rect(market.querySelector('.chronicles-shop__detail')) };
        });
        assert(position.peek.left >= position.catalog.right + 2
          && position.peek.right <= position.detail.left - 2
          && position.peek.width >= 180,
          'Preview must be readable to the RIGHT of the clipped catalogue: ' + JSON.stringify(position));
        // The painted keeper is the room's visual focal point, not a tooltip backdrop.
        // Brunna's face occupies the right half of the aisle at desktop widths.
        assert(position.peek.right <= width * .63,
          'Desktop comparison obscures Brunna: ' + JSON.stringify(position));
        assert.equal(await dagger.locator('.chronicles-shop__gear-peek').count(), 0,
          'Wide hover must never expand or reflow the stock ledger');
      }
      assert.equal(await detail.locator('.chronicles-shop__compare-toggle').count(), 0,
        'Comparison must no longer produce a dashboard inside the purchase receipt');
      if (width > 900) {
        // Keyboard focus is equivalent to hover; leaving the row dismisses it.
        await dagger.locator('button').focus();
        await peek.waitFor({ state: 'visible' });
        await catalog.getByLabel('Orden').focus();
        await peek.waitFor({ state: 'hidden' });
      }
      if ([390, 1280].includes(width)) {
        if (!portraitPhone) await dagger.locator('button').focus();
        await peek.waitFor({ state: 'visible' });
        await page.screenshot({ path: `smoke-shop-gear-peek-${width}.png` });
      }
      if (portraitPhone) {
        assert.equal(await catalog.isVisible(), false, 'Portrait inspection must hide stock without destroying it');
        const stockReturn = detail.getByRole('button', { name: '← Volver a mercancías' });
        await stockReturn.click();
        await catalog.waitFor({ state: 'visible' });
        assert.equal(await dialog.locator('[data-chronicles-shop-item]').count(), 11,
          'Returning from inspection must preserve full inventory');
        await dagger.locator('button').click();
        await detail.getByRole('heading', { name: 'Daga de latón' }).waitFor();
      }

      // All weapon families use the same per-hero preview as Odo's armour.
      // Use the actual longbow from Brunna: it is restricted to its real class.
      if ([390, 844, 1280].includes(width)) {
        const longbow = dialog.locator('[data-chronicles-shop-item="wooden-longbow"]');
        if (portraitPhone) {
          await detail.getByRole('button', { name: '← Volver a mercancías' }).click();
          await catalog.waitFor({ state: 'visible' });
        }
        if (width <= 900) await longbow.locator('button').click();
        else {
          await longbow.locator('button').click();
          await longbow.locator('button').hover();
        }
        const rangePreview = width <= 900
          ? detail.locator('[data-chronicles-shop-party-comparison]')
          : dialog.locator('.chronicles-shop__peek-stage [data-chronicles-shop-party-comparison]');
        await rangePreview.waitFor({ state: 'visible' });
        assert.equal(await rangePreview.locator('[data-chronicles-shop-hero]').count(), 4,
          'Ranged-weapon preview must name all four heroes separately');
        assert.match(await rangePreview.innerText(), /No puede equiparlo/,
          'Ranged-weapon preview must explain class restrictions');
        assert.match(await rangePreview.innerText(), /Acierto|Daño|Alcance/,
          'Ranged-weapon preview must include actual ranged statistics');
        assert.doesNotMatch(await rangePreview.innerText(), /MM3/,
          'Merchant comparison must never print engine/ruleset jargon');
        if (width === 844) {
          await assertLandscapeCheckoutVisible(dialog, 'Longbow comparison');
          const visibility = await rangePreview.evaluate((peek) => {
            const inspection = peek.closest('.chronicles-shop__inspection');
            const frame = inspection.getBoundingClientRect();
            return {
              noHorizontalOverflow: peek.scrollWidth <= peek.clientWidth + 1,
              rows: [...peek.querySelectorAll('[data-chronicles-shop-hero]')].map((row) => {
                const r = row.getBoundingClientRect();
                return { name: row.getAttribute('data-chronicles-shop-hero'),
                  fullyVisible: r.top >= frame.top && r.bottom <= frame.bottom - 2 };
              }),
            };
          });
          assert(visibility.noHorizontalOverflow, 'Weapon comparison overflows horizontally: ' + JSON.stringify(visibility));
          assert(visibility.rows.every((row) => row.fullyVisible),
            'All four heroes must fit above pinned checkout without scrolling: ' + JSON.stringify(visibility));
        }
        await page.screenshot({ path: `smoke-shop-ranged-comparison-${width}.png` });
        if (portraitPhone) {
          await detail.getByRole('button', { name: '← Volver a mercancías' }).click();
          await catalog.waitFor({ state: 'visible' });
        }
        await dagger.locator('button').click();
        await detail.getByRole('heading', { name: 'Daga de latón' }).waitFor();
      }

      // Buy and sell through the real reducer (not fake onAction state).
      const before = Number((await dialog.locator('.chronicles-shop__purse').getAttribute('aria-label')).match(/\d+/)?.[0]);
      await detail.locator('.chronicles-shop__primary').click();
      await page.waitForFunction((previous) => {
        const text = document.querySelector('.chronicles-shop__purse')?.getAttribute('aria-label') || '';
        return Number(text.match(/\d+/)?.[0]) < previous;
      }, before);
      assert.match(await page.locator('[data-test-action]').innerText(), /shop-buy:brass-dagger/);
      await dialog.getByRole('tab', { name: /Vender/ }).click();
      const sellRow = dialog.locator('[data-chronicles-shop-sell="brass-dagger"]');
      await sellRow.waitFor();
      await sellRow.locator('button').click();
      await detail.getByRole('button', { name: /Vender una unidad/ }).click();
      await page.waitForFunction(() => document.querySelector('[data-test-action]')?.textContent?.includes('shop-sell:brass-dagger'));
      assert.equal(await dialog.locator('[data-chronicles-shop-sell="brass-dagger"]').count(), 0,
        'Sale should remove the only stored dagger');

      assert.deepEqual(errors, [], `Browser exceptions at ${width}px`);
      await page.keyboard.press('Escape');
      if (portraitPhone) {
        await catalog.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
      }
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), '',
        'Closing the shop must restore game scrolling');
      console.log(`CHRONICLES_SHOP_VISUAL_OK ${width}x${height} 1672x941 artwork and commerce`);
    } catch (error) {
      failed++;
      console.error(`CHRONICLES_SHOP_VISUAL_FAIL ${width}x${height}: ${error.stack || error}`);
      await page.screenshot({ path: `smoke-shop-FAIL-${width}.png` }).catch(() => {});
    } finally {
      await context.close();
    }
  }

  // A near-full purse is a genuine boundary of the campaign reducer. Don't
  // offer a clickable sale which would be silently rejected; once the company
  // spends enough gold, the identical item must become sellable immediately.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      await gotoReadyShop(page, url + '?gold-cap=1');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByRole('tab', { name: /Vender/ }).click();
      const soldItem = dialog.locator('[data-chronicles-shop-sell="brass-dagger"]');
      await soldItem.locator('button').click();
      const detail = dialog.locator('.chronicles-shop__detail');
      const checkout = detail.locator('.chronicles-shop__primary');
      assert.equal(await checkout.isDisabled(), true, 'Gold cap must block unpayable sale');
      assert.match(await checkout.innerText(), /Bolsa de oro llena/);
      assert.match(await detail.locator('.chronicles-shop__checkout-hint').innerText(),
        /Límite: 9\.999 oro\. Gasta al menos 1 oro/);
      await page.screenshot({ path: 'smoke-shop-gold-cap-1280.png' });
      await dialog.getByRole('tab', { name: 'Comprar' }).click();
      await dialog.locator('[data-chronicles-shop-item="brass-dagger"] button').click();
      await detail.getByRole('button', { name: 'Comprar', exact: true }).click();
      await page.getByRole('tab', { name: /Vender/ }).click();
      await soldItem.locator('button').click();
      const enabledSale = detail.getByRole('button', { name: 'Vender una unidad' });
      await enabledSale.waitFor({ state: 'visible' });
      assert.equal(await enabledSale.isEnabled(), true,
        'Spending gold must immediately unblock sale');
      await enabledSale.click();
      await page.waitForFunction(() =>
        document.querySelector('[data-test-action]')?.textContent?.includes('shop-sell:brass-dagger'));
      assert.equal(await checkout.isDisabled(), true, 'Wallet is full again after sale');
      console.log('CHRONICLES_SHOP_GOLD_CAP_OK 9999 blocked, spent 1, sold 1');
    } catch (error) {
      failed++;
      console.error('CHRONICLES_SHOP_GOLD_CAP_FAIL: ' + (error.stack || error));
      await page.screenshot({ path: 'smoke-shop-FAIL-gold-cap.png' }).catch(() => {});
    } finally {
      await context.close();
    }
  }

  // The other merchant rooms need their own evidence. Odo now has widescreen
  // authored vector art; the guild now has its own illustrated library.
  // Test each REAL scene and its interactive layout.
  for (const room of ['odo', 'guild']) {
    for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
      const context = await browser.newContext({
        viewport: { width, height }, isMobile: width <= 844,
        hasTouch: width <= 844, deviceScaleFactor: 1,
        reducedMotion: width === 390 ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await gotoReadyShop(page, url + '?room=' + room);
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible' });
        const scene = dialog.locator('.chronicles-shop__scene');
        const expected = room === 'odo' ? 'odo-forge' : 'guild-sanctum';
        assert.equal(await scene.getAttribute('data-chronicles-shop-room'), expected);
        const img = scene.locator('img').first(); // Approved R2 adds an optional second overlay.
        await img.waitFor();
        const art = await img.evaluate((image) => ({
          loaded: image.complete && image.naturalWidth > 0,
          width: image.naturalWidth, height: image.naturalHeight,
          src: image.currentSrc,
        }));
        assert(art.loaded, room + ': artwork did not decode at ' + width);
        assert(art.width >= 48 && art.height >= 48, room + ': tiny/corrupt image');
        assert(art.src.includes(room === 'odo' ? 'odo-armory.svg' : 'guild-archive.svg'), room + ': wrong base artwork source');
        if (room === 'guild') {
          const fallback = scene.locator('img[data-chronicles-shop-art-layer="fallback"]');
          const overlay = scene.locator('img[data-chronicles-shop-art-layer="premium"]');
          assert.equal(await fallback.count(), 1, 'Guild local archive must remain visible');
          assert.equal(await overlay.count(), 1, 'Guild should load uploaded R2 WebP');
          // R2 is an optional enhancement. A pending request must not block
          // the bundled archive; if it actually decoded, still require the
          // React ready marker before asserting the full-size panorama.
          await page.waitForFunction(() => {
            const node = document.querySelector('[data-chronicles-shop-room="guild-sanctum"] img[data-chronicles-shop-art-layer="premium"]');
            return node && (!node.complete || !node.naturalWidth || node.classList.contains('is-ready'));
          }, null, { timeout: 7_000 });
          const artState = await overlay.evaluate(node => ({
            src: node.currentSrc || node.src,
            complete: node.complete,
            width: node.naturalWidth,
            height: node.naturalHeight,
            ready: node.classList.contains('is-ready'),
            opacity: Number.parseFloat(getComputedStyle(node).opacity),
            position: getComputedStyle(node).position,
          }));
          assert.equal(artState.src, 'https://assets.chronicles.shadowops.dpdns.org/stores/gremio-premium.webp');
          assert.equal(artState.position, 'absolute', 'Guild overlay must not stack beneath the fallback');
          if (artState.complete && artState.width) {
            assert(artState.width >= 1500 && artState.height >= 800 && artState.ready,
              'Decoded Guild painterly panorama must become visible');
          } else {
            assert(!artState.ready && artState.opacity === 0,
              'Pending or failed R2 Guild art must leave the bundled archive in place');
          }
        }
        if (room === 'odo') {
          // The exact uploaded Chronicles R2 WebP has a local fallback that MUST remain
          // visible until the approved remote WebP decodes. A failed fetch
          // must not break merchant interaction or show an empty image.
          const overlay = scene.locator('[data-chronicles-shop-art-layer="premium"]');
          if (await overlay.count()) {
            await page.waitForFunction(() => {
              const remote = document.querySelector('[data-chronicles-shop-art-layer="premium"]');
              return remote && (!remote.complete || !remote.naturalWidth || remote.classList.contains('is-ready'));
            }, null, { timeout: 5_000 });
            const checked = await overlay.evaluate((node) => ({
              src: node.currentSrc || node.src, complete: node.complete,
              width: node.naturalWidth, height: node.naturalHeight,
              ready: node.classList.contains('is-ready'),
              opacity: Number.parseFloat(getComputedStyle(node).opacity),
            }));
            assert.match(checked.src, /^https:\/\/assets\.chronicles\.shadowops\.dpdns\.org\/stores\/Odo_Armeria_Premium_Fondo_Limpio_2026\.webp$/,
              'Only the exact uploaded Chronicles R2 Odo WebP may overlay the room');
            if (checked.complete && checked.width > 0) {
              assert(checked.width >= 1500 && checked.height >= 800,
                'Approved Odo WebP must be a full-quality panoramic background');
              assert(checked.ready, 'Decoded R2 art must be promoted to the visible layer');
            } else {
              assert(!checked.ready && checked.opacity === 0,
                'Pending or broken CDN art must remain hidden over the local room');
            }
          }

          for (const [id, alt] of [
            ['wooden-shield', 'Escudo de madera'],
            ['leather-leather', 'Coraza de cuero'],
          ]) {
            const node = dialog.locator('[data-chronicles-shop-item="' + id + '"] img[data-chronicles-shop-art="' + id + '"]');
            await node.waitFor({ state: 'visible' });
            assert.equal(await node.getAttribute('alt'), alt);
            const picture = await node.evaluate((img) => ({
              width: img.naturalWidth, height: img.naturalHeight, loaded: img.complete,
            }));
            assert(picture.loaded && picture.width >= 512 && picture.height >= 512,
              id + ': Odo premium sprite failed to decode ' + JSON.stringify(picture));
          }
          for (const [id, alt] of [
            ['brass-shield', 'Escudo de latón'],
            ['brass-ring', 'Cota de anillas de latón'],
          ]) {
            const node = dialog.locator('[data-chronicles-shop-item="' + id + '"] img[data-chronicles-shop-art="' + id + '"]');
            await node.waitFor({ state: 'visible' });
            assert.equal(await node.getAttribute('alt'), alt);
            const picture = await node.evaluate((img) => ({
              width: img.naturalWidth, height: img.naturalHeight, loaded: img.complete,
            }));
            assert(picture.loaded && picture.width >= 512 && picture.height >= 512,
              id + ': premium brass sprite failed to decode ' + JSON.stringify(picture));
          }
          for (const [id, alt] of [
            ['brass-scale', 'Cota de escamas de latón'],
            ['leather-padded', 'Gambesón de cuero'],
          ]) {
            const node = dialog.locator('[data-chronicles-shop-item="' + id + '"] img[data-chronicles-shop-art="' + id + '"]');
            await node.waitFor({ state: 'visible' });
            assert.equal(await node.getAttribute('alt'), alt);
            const size = await node.evaluate((img) => ({
              w: img.naturalWidth, h: img.naturalHeight, complete: img.complete,
            }));
            assert(size.complete && size.w >= 512 && size.h >= 512,
              id + ': dedicated 2D armour portrait failed to decode ' + JSON.stringify(size));
          }
          const guardVest = dialog.locator('[data-chronicles-shop-item="roadwatch-vest"] img[data-chronicles-shop-art="roadwatch-vest"]');
          await guardVest.waitFor({ state: 'visible' });
          assert.equal(await guardVest.getAttribute('alt'), 'Jubón de cuero de guardia');
          const guardSize = await guardVest.evaluate((img) => ({
            w: img.naturalWidth, h: img.naturalHeight, complete: img.complete,
          }));
          assert(guardSize.complete && guardSize.w >= 512 && guardSize.h >= 512,
            'Guard vest full-resolution portrait failed: ' + JSON.stringify(guardSize));
          const covered = await dialog.locator('[data-chronicles-shop-item] img[data-chronicles-shop-art]').count();
          assert.equal(covered, 7, 'All seven Odo stock items need their own sprite');
          assert.equal(await dialog.locator('[data-chronicles-shop-item] svg[data-chronicles-shop-glyph]').count(), 0,
            'No generic icon remains in Odo stock');
          // Verify the real room receives non-interactive light. One mobile
          // scenario exercises the reduced-motion fallback, not just CSS text.
          const light = await scene.evaluate((node) => ({
            pointer: getComputedStyle(node, '::after').pointerEvents,
            layer: getComputedStyle(node, '::after').backgroundImage,
            animation: getComputedStyle(node, '::after').animationName,
            opacity: Number.parseFloat(getComputedStyle(node, '::after').opacity),
            theme: node.closest('.chronicles-shop')?.getAttribute('data-chronicles-shop-room-theme'),
          }));
          assert.equal(light.theme, 'odo-forge');
          assert.equal(light.pointer, 'none', 'Forge light must never capture interaction');
          assert.match(light.layer, /radial-gradient/, 'Forge lighting is not rendered');
          assert(light.opacity > 0 && light.opacity <= 1, 'Invalid forge light opacity');
          if (width === 390) assert.equal(light.animation, 'none',
            'Reduced-motion users must not see forge light pulses');
          const presentation = await img.evaluate((node) => ({
            width: node.getBoundingClientRect().width,
            fit: getComputedStyle(node).objectFit,
            rendering: getComputedStyle(node).imageRendering,
          }));
          assert(art.width >= 1500 && art.height >= 800,
            'Odo room must use the authored widescreen illustration');
          assert.equal(presentation.fit, 'cover',
            'Odo room should fill the panoramic background, not appear as a pixel inset');
          assert.notEqual(presentation.rendering, 'pixelated',
            'The new illustration should render smoothly');
          assert(presentation.width >= width - 2 && presentation.width <= width + 2,
            'Odo illustration must fill the available room width: ' + JSON.stringify(presentation));
          if (width === 1280) {
            const title = await dialog.locator('.chronicles-shop__identity h2').evaluate((node) => ({
              height: node.getBoundingClientRect().height,
              lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight),
            }));
            assert(title.height <= title.lineHeight * 1.25,
              'Odo desktop heading steals a second line from the illustrated room: ' + JSON.stringify(title));
          }
        }
        if (room === 'guild') {
          const lighting = await scene.evaluate((node) => ({
            pointer: getComputedStyle(node, '::after').pointerEvents,
            light: getComputedStyle(node, '::after').backgroundImage,
            animation: getComputedStyle(node, '::after').animationName,
            opacity: Number.parseFloat(getComputedStyle(node, '::after').opacity),
          }));
          assert.equal(lighting.pointer, 'none', 'Guild ambience must never block the real join button');
          assert.match(lighting.light, /radial-gradient/, 'Guild room has no authored light bounce');
          assert(lighting.opacity > 0 && lighting.opacity <= 1);
          if (width === 390) assert.equal(lighting.animation, 'none',
            'Guild must respect reduced-motion');
          const presentation = await img.evaluate((node) => ({
            width: node.getBoundingClientRect().width,
            fit: getComputedStyle(node).objectFit,
            rendering: getComputedStyle(node).imageRendering,
          }));
          assert(art.width >= 1500 && art.height >= 800,
            'Guild art must be a native-size panoramic illustration');
          assert.equal(presentation.fit, 'cover',
            'Guild illustrated archive must fill its panoramic backdrop');
          assert.notEqual(presentation.rendering, 'pixelated',
            'Guild art is not the legacy small pixel sprite');
          assert(presentation.width >= width - 2 && presentation.width <= width + 2,
            'Guild illustration must fill the available width: ' + JSON.stringify(presentation));
        }
        const geometry = await page.evaluate(() => {
          const bounds = (selector) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const r = node.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
          };
          return {
            dialog: bounds('.chronicles-shop'),
            scene: bounds('.chronicles-shop__scene'),
            market: bounds('.chronicles-shop__market'),
            catalog: bounds('.chronicles-shop__catalog'),
            detail: bounds('.chronicles-shop__detail'),
            spells: bounds('.chronicles-guild__spells'),
            overflow: document.documentElement.scrollWidth,
            bodyScroll: document.body.style.overflow,
          };
        });
        assert.equal(geometry.bodyScroll, 'hidden', room + ': world scroll must remain locked');
        if (width === 390) {
          const close = await dialog.locator('.chronicles-shop__close').boundingBox();
          assert(close?.width >= 44 && close?.height >= 44,
            room + ': portrait close target is too small: ' + JSON.stringify(close));
        }
        assert(geometry.overflow <= width + 1, room + ': horizontal overflow ' + width);
        assert(geometry.dialog.left >= -1 && geometry.dialog.right <= width + 1);
        assert(geometry.dialog.top >= -1 && geometry.dialog.bottom <= height + 1);
        if (room === 'odo') {
          assert(geometry.catalog.width > 240 && (
            width <= 900 && height > width ? geometry.detail.width === 0 : geometry.detail.width > 240
          ), 'Odo must keep an accessible stock-first merchant layout: ' + JSON.stringify(geometry));
          if (width === 844) {
            const stock = await dialog.locator('.chronicles-shop__list').evaluate((list) => {
              const bounds = list.getBoundingClientRect();
              const rows = [...list.querySelectorAll('[data-chronicles-shop-item]')];
              return {
                total: rows.length,
                columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
                client: list.clientHeight, scroll: list.scrollHeight,
                visible: rows.filter((row) => {
                  const r = row.getBoundingClientRect();
                  return r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1;
                }).length,
              };
            });
            assert.equal(stock.total, 7, 'Odo must keep all seven real items');
            assert.equal(stock.columns, 2, 'Odo merchandise must span two columns in landscape');
            assert.equal(stock.visible, 7, 'All seven Odo items must be visible without scrolling: ' + JSON.stringify(stock));
            assert(stock.scroll <= stock.client + 2,
              'Odo must not need catalogue scrolling at 844×390: ' + JSON.stringify(stock));
          }
        }
        else {
          assert(await dialog.locator('[data-chronicles-guild-spell]').count() > 0, 'Guild spells must be listed');
          if (width <= 844) {
            assert(geometry.spells.bottom >= height - 26,
              'Guild catalogue leaves dead space on mobile: ' + JSON.stringify(geometry));
          }
          assert.equal(await scene.evaluate((element) => getComputedStyle(element).pointerEvents), 'none',
            'Guild art must never intercept the membership button');
          const seal = await dialog.locator('.chronicles-guild__membership').evaluate((node) => ({
            image: getComputedStyle(node, '::after').backgroundImage,
            pointer: getComputedStyle(node, '::after').pointerEvents,
            display: getComputedStyle(node, '::after').display,
          }));
          assert.equal(seal.pointer, 'none', 'The guild seal must not intercept join controls');
          if (width >= 901 && height >= 700) {
            assert.notEqual(seal.image, 'none', 'The desktop guild seal is missing');
            assert.notEqual(seal.display, 'none', 'Desktop guild seal should be visible');
          } else {
            assert.equal(seal.display, 'none', 'Compact guild must prioritize spells over decoration');
          }
        }
        await page.screenshot({ path: `smoke-shop-${room}-${width}.png` });
        if (width === 390 || width === 1280) {
          await captureArtworkOnly(page, 'smoke-shop-art-only-' + room + '-' + width + '.png');
        }
        if (room === 'odo') {
          const vest = dialog.locator('[data-chronicles-shop-item="leather-padded"]');
          if (width > 900) await vest.locator('button').hover();
          else await vest.locator('button').click();
          if (width <= 900) {
            const comparison = dialog.locator('.chronicles-shop__detail .chronicles-shop__mobile-preview');
            await comparison.locator('[data-chronicles-shop-party-comparison]').waitFor({ state: 'visible' });
            assert.equal(await vest.locator('.chronicles-shop__gear-peek').count(), 0,
              'Touching Odo merchandise must not expand the stock row');
          }
          const note = width <= 900
            ? dialog.locator('.chronicles-shop__detail .chronicles-shop__mobile-preview .chronicles-shop__gear-peek')
            : width >= 1180 && height >= 540
              ? dialog.locator('.chronicles-shop__peek-stage .chronicles-shop__gear-peek')
              : vest.locator('.chronicles-shop__gear-peek');
          await note.waitFor({ state: 'visible' });
          const odoRows = await note.locator('.chronicles-shop__gear-peek-member').count();
          if (width <= 900) {
            assert.equal(odoRows, 4, 'Odo must show one separate real outcome per hero');
            for (const name of ['Matthias', 'Hildegard', 'Aziz', 'Faust']) {
              assert((await note.innerText()).includes(name), 'Odo compact preview lost ' + name);
            }
          } else assert.equal(odoRows, 4);
          assert.match(await note.innerText(), /CA|Armadura|No puede equiparlo|Sin cambios/);
          assert.doesNotMatch(await note.innerText(), /MM3|no reduce el daño/,
            'Merchant should show deltas, not system-rules lectures');
          if (width === 844) await assertLandscapeCheckoutVisible(dialog, 'Odo per-hero armor preview');
          assert.doesNotMatch(await note.innerText(), /Reducción de daño [+-]\d/,
            'MM3 must not advertise damage mitigation that its combat code never applies');
          assert.equal(await dialog.locator('.chronicles-shop__compare-toggle').count(), 0);
          await dialog.getByRole('tab', { name: /Vender/ }).click();
          await dialog.getByRole('tab', { name: 'Comprar' }).click();
        } else {
          // Compatibility is a presentation-only filter, never a school rule
          // or a destructive change to the guild's authored spell catalogue.
          const allGuildSpells = dialog.locator('[data-chronicles-guild-spell]');
          const totalSpells = await allGuildSpells.count();
          const usableSpells = await dialog.locator('[data-chronicles-guild-compatible="true"]').count();
          assert(totalSpells > 0, 'Guild authored stock disappeared');
          const filterButton = dialog.getByRole('button', { name: 'Solo compatibles' });
          await filterButton.click();
          assert.equal(await filterButton.getAttribute('aria-pressed'), 'true');
          assert.equal(await allGuildSpells.count(), usableSpells,
            'Guild compatible filter must match the actual character-school eligibility');
          if (width === 390) await page.screenshot({ path: 'smoke-shop-guild-filter-390.png' });
          await filterButton.click();
          assert.equal(await filterButton.getAttribute('aria-pressed'), 'false');
          assert.equal(await allGuildSpells.count(), totalSpells,
            'Turning the filter off must restore every authored spell');
          // Membership and spells are the guild's real workflow, not shop tabs.
          await dialog.locator('[data-chronicles-guild-join]').waitFor();
          await dialog.locator('[data-chronicles-guild-join]').click();
          await dialog.locator('[data-chronicles-guild-join]').waitFor({ state: 'detached' });
          await dialog.getByText('Compañía afiliada').waitFor();
          if (width === 390) await page.screenshot({ path: 'smoke-shop-guild-member-390.png' });
        }
        assert.deepEqual(errors, [], room + ': browser exceptions');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        console.log(`CHRONICLES_SHOP_ROOM_OK room=${room} ${width}x${height} asset=${art.width}x${art.height}`);
      } catch (error) {
        failed++;
        console.error(`CHRONICLES_SHOP_ROOM_FAIL ${room} ${width}x${height}: ${error.stack || error}`);
        await page.screenshot({ path: `smoke-shop-FAIL-${room}-${width}.png` }).catch(() => {});
      } finally {
        await context.close();
      }
    }
  }

  // The apothecary is a merchant too, but its stock is consumable; never show
  // made-up equipment deltas for a potion or scroll. Test real authored items.
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const mobile = width <= 900;
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
    });
    const page = await context.newPage();
    try {
      await gotoReadyShop(page, url + '?room=apothecary');
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      assert.match(await dialog.locator('h2').innerText(), /Botica de Swordhaven/);
      const boticaRoom = dialog.locator('.chronicles-shop__scene[data-chronicles-shop-room="botica-apothecary"]');
      const boticaFallback = boticaRoom.locator('img[data-chronicles-shop-art-layer="fallback"]');
      const boticaPremium = boticaRoom.locator('img[data-chronicles-shop-art-layer="premium"]');
      assert.equal(await boticaFallback.count(), 1, 'Botica must keep bundled room as fallback');
      assert.equal(await boticaPremium.count(), 1, 'Botica must try the exact uploaded premium WebP');
      const localArt = await boticaFallback.evaluate(node => ({
        loaded: node.complete && node.naturalWidth >= 1500 && node.naturalHeight >= 800,
        src: node.currentSrc, position: getComputedStyle(node).objectPosition,
      }));
      assert(localArt.loaded && localArt.src.includes('botica-apothecary.svg'),
        'Botica local illustrated room must always decode');
      assert.match(localArt.position, /^50% /, 'Botica shopkeeper must stay in the central aisle');
      // R2 can remain pending or fail in CI. The bundled fallback is required
      // above; the optional overlay is inspected without waiting for network.
      // If it has decoded already, it must be revealed; otherwise it must
      // remain hidden so the fallback is visible without a broken image.
      const remoteArt = await boticaPremium.evaluate(node => ({
        // currentSrc can be empty while R2 is pending: src retains the exact
        // declared, browser-resolved URL without waiting for remote bytes.
        src: node.currentSrc || node.src, loaded: node.naturalWidth >= 1500 && node.naturalHeight >= 800,
        ready: node.classList.contains('is-ready'),
        opacity: Number.parseFloat(getComputedStyle(node).opacity),
      }));
      assert.equal(remoteArt.src,
        'https://assets.chronicles.shadowops.dpdns.org/stores/botica-premium.webp');
      // naturalWidth can be set before img.decode() settles and React commits
      // is-ready. Check the rendered state rather than treating bytes as paint.
      if (remoteArt.ready) {
        assert(remoteArt.loaded, 'Revealed Botica premium art must be loaded');
      } else {
        assert(remoteArt.opacity === 0,
          'Pending or failed premium decode must leave the Botica SVG visible');
      }
      assert.equal(await dialog.locator('[data-chronicles-shop-item]').count(), 3,
        'Apothecary must keep all three authored offers');
      for (const id of ['healing-potion', 'mana-potion', 'fire-scroll']) {
        const artwork = dialog.locator('[data-chronicles-shop-item="' + id + '"] img[data-chronicles-shop-art="' + id + '"]');
        await artwork.waitFor({ state: 'visible' });
        const picture = await artwork.evaluate(node => ({
          decoded: node.complete, width: node.naturalWidth, height: node.naturalHeight,
        }));
        assert(picture.decoded && picture.width === 512 && picture.height === 512,
          id + ': Botica art must decode at 512 pixels: ' + JSON.stringify(picture));
      }
      assert.equal(await dialog.locator('[data-chronicles-shop-item] svg[data-chronicles-shop-glyph]').count(), 0,
        'Botica must not use generic glyphs for its authored merchandise');
      const potion = dialog.locator('[data-chronicles-shop-item="healing-potion"]');
      if (mobile) await potion.locator('button').click();
      else await potion.locator('button').hover();
      const peekInAisle = width >= 1180 && height >= 540;
      if (mobile) await dialog.locator('.chronicles-shop__detail .chronicles-shop__consumable-peek').waitFor({ state: 'visible' });
      const note = mobile
        ? dialog.locator('.chronicles-shop__detail .chronicles-shop__consumable-peek')
        : peekInAisle
          ? dialog.locator('.chronicles-shop__peek-stage .chronicles-shop__consumable-peek')
          : potion.locator('.chronicles-shop__consumable-peek');
      await note.waitFor({ state: 'visible' });
      assert.match(await note.innerText(), /15 PV/);
      assert.match(await note.innerText(), /Toda la compañía/);
      assert.equal(await note.locator('.chronicles-shop__gear-peek-delta').count(), 0,
        'Potions do not equip and cannot invent combat-stat differences');
      const scroll = dialog.locator('[data-chronicles-shop-item="fire-scroll"]');
      if (mobile) {
        await dialog.getByRole('button', { name: '← Volver a mercancías' }).click();
        await scroll.locator('button').click();
      } else await scroll.locator('button').hover();
      const scrollNote = mobile
        ? dialog.locator('.chronicles-shop__detail .chronicles-shop__consumable-peek')
        : peekInAisle
          ? dialog.locator('.chronicles-shop__peek-stage .chronicles-shop__consumable-peek')
          : scroll.locator('.chronicles-shop__consumable-peek');
      await scrollNote.waitFor({ state: 'visible' });
      assert.match(await scrollNote.innerText(),
        /14 de daño · objetivo visible/);
      assert.equal(await dialog.locator('.chronicles-shop__compare-toggle').count(), 0);
      await page.screenshot({ path: `smoke-shop-apothecary-peek-${width}.png` });
      await dialog.getByRole('tab', { name: /Vender/ }).click();
      await dialog.getByRole('tab', { name: 'Comprar' }).click();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      console.log(`CHRONICLES_SHOP_APOTHECARY_PREVIEW_OK ${width}x${height}`);
    } catch (error) {
      failed++;
      console.error(`CHRONICLES_SHOP_APOTHECARY_FAIL ${width}x${height}: ${error.stack || error}`);
      await page.screenshot({ path: `smoke-shop-FAIL-apothecary-${width}.png` }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
