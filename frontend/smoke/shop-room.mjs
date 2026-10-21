// Shop-specific Chromium regression smoke: real React component + real reducer,
// no production-only debug routes or staging login requirements.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/shop-room.html';
const views = [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800], [1440, 900]];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;

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
      await page.goto(url, { waitUntil: 'networkidle' });
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
      assert(boxes.catalog.width > 240 && boxes.detail.width > 240,
        `Unusable shop panels at ${width}px: ${JSON.stringify(boxes)}`);
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
          assert(boxes.catalog.right + 35 < boxes.detail.left,
            `Landscape lost Brunna between the panels: ${JSON.stringify(boxes)}`);
          assert(boxes.list.height > 80,
            `Landscape stock cannot scroll: ${JSON.stringify(boxes)}`);
          assert(boxes.catalog.bottom <= height + 1 && boxes.detail.bottom <= height + 1,
            `Landscape panels escape viewport: ${JSON.stringify(boxes)}`);
        }
      }
      await page.screenshot({ path: `smoke-shop-${width}.png` });

      // Longbows are real missile weapons, never generic potion-like items.
      const longbow = dialog.locator('[data-chronicles-shop-item="wooden-longbow"]');
      assert.match(await longbow.innerText(), /Armas a distancia/);
      assert.equal(await longbow.locator('svg').getAttribute('aria-label'), 'Arma a distancia');

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
      const compare = detail.getByRole('button', { name: /Comparar con mi equipo/ });
      await compare.click();
      await detail.locator('.chronicles-shop__comparison-hero').first().waitFor();
      if ([390, 1280].includes(width)) {
        await page.screenshot({ path: `smoke-shop-compare-${width}.png` });
      }
      await detail.getByRole('button', { name: /Ocultar comparación/ }).click();

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
      await page.goto(url + '?gold-cap=1', { waitUntil: 'networkidle' });
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
  // authored vector art; the guild still uses its existing small PNG.
  // Test each REAL scene and its interactive layout.
  for (const room of ['odo', 'guild']) {
    for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
      const context = await browser.newContext({
        viewport: { width, height }, isMobile: width <= 844,
        hasTouch: width <= 844, deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(url + '?room=' + room, { waitUntil: 'networkidle' });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible' });
        const scene = dialog.locator('.chronicles-shop__scene');
        const expected = room === 'odo' ? 'odo-forge' : 'guild-sanctum';
        assert.equal(await scene.getAttribute('data-chronicles-shop-room'), expected);
        const img = scene.locator('img');
        await img.waitFor();
        const art = await img.evaluate((image) => ({
          loaded: image.complete && image.naturalWidth > 0,
          width: image.naturalWidth, height: image.naturalHeight,
          src: image.currentSrc,
        }));
        assert(art.loaded, room + ': artwork did not decode at ' + width);
        assert(art.width >= 48 && art.height >= 48, room + ': tiny/corrupt image');
        assert(art.src.includes(room === 'odo' ? 'odo-armory.svg' : expected + '.png'), room + ': wrong artwork source');
        if (room === 'odo') {
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
        assert(geometry.overflow <= width + 1, room + ': horizontal overflow ' + width);
        assert(geometry.dialog.left >= -1 && geometry.dialog.right <= width + 1);
        assert(geometry.dialog.top >= -1 && geometry.dialog.bottom <= height + 1);
        if (room === 'odo') assert(geometry.catalog.width > 240 && geometry.detail.width > 240);
        else {
          assert(await dialog.locator('[data-chronicles-guild-spell]').count() > 0, 'Guild spells must be listed');
          if (width <= 844) {
            assert(geometry.spells.bottom >= height - 26,
              'Guild catalogue leaves dead space on mobile: ' + JSON.stringify(geometry));
          }
          assert.equal(await scene.evaluate((element) => getComputedStyle(element).pointerEvents), 'none',
            'Guild art must never intercept the membership button');
        }
        await page.screenshot({ path: `smoke-shop-${room}-${width}.png` });
        if (room === 'odo') {
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
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
