import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4174/smoke/inn-room.html';
const browser = await chromium.launch();
try {
  for (const [width,height] of [[360,780],[390,844],[430,932],[844,390],[1280,800]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const room = page.getByRole('dialog', { name: 'Taberna La Espada Mellada' });
      await room.waitFor({ state:'visible' });
      await page.locator('[data-chronicles-interior-loading]').waitFor({ state: 'detached', timeout: 16_000 });
      // Browser visibility alone is insufficient: the real game root sits
      // at z-index 10000 and used to cover this portalled inn at z-index 190.
      const layers = await page.evaluate(() => {
        const world = document.querySelector('[data-inn-world-shell]');
        const inn = document.querySelector('[data-chronicles-inn-room]');
        const close = inn?.querySelector('button[aria-label="Salir de la taberna"]');
        if (!world || !inn || !close) return null;
        const bounds = close.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2);
        return {
          world: Number.parseInt(getComputedStyle(world).zIndex, 10),
          inn: Number.parseInt(getComputedStyle(inn).zIndex, 10),
          closeOnTop: close === hit || close.contains(hit),
        };
      });
      assert.ok(layers && layers.inn > layers.world && layers.closeOnTop,
        'Tavern must be painted and clickable ABOVE the first-person world: ' + JSON.stringify(layers));
      assert.equal(await page.locator('[data-chronicles-inn-room]').getAttribute('data-chronicles-inn-room'),
        'first-book-healer');
      const scene = room.locator('.chronicles-inn__scene');
      const fallback = scene.locator('img[data-chronicles-shop-art-layer="fallback"]');
      const premium = scene.locator('img[data-chronicles-shop-art-layer="premium"]');
      assert.equal(await fallback.count(), 1, 'Original tavern background remains accessible');
      assert.equal(await premium.count(), 1, 'Tavern attempts its player-uploaded premium WebP');
      await page.waitForFunction(() => {
        const base = document.querySelector('.chronicles-inn__scene img[data-chronicles-shop-art-layer="fallback"]');
        const top = document.querySelector('.chronicles-inn__scene img[data-chronicles-shop-art-layer="premium"]');
        return base?.complete && base.naturalWidth > 0
          && top?.complete && (!top.naturalWidth || top.classList.contains('is-ready'));
      }, null, { timeout: 7000 });
      const sceneState = await scene.evaluate(node => {
        const base = node.querySelector('[data-chronicles-shop-art-layer="fallback"]');
        const overlay = node.querySelector('[data-chronicles-shop-art-layer="premium"]');
        return {
          baseWidth: base.naturalWidth,
          baseHeight: base.naturalHeight,
          overlayUrl: overlay.currentSrc,
          overlayWidth: overlay.naturalWidth,
          overlayHeight: overlay.naturalHeight,
          overlayReady: overlay.classList.contains('is-ready'),
          overlayOpacity: Number.parseFloat(getComputedStyle(overlay).opacity),
          basePosition: getComputedStyle(base).position,
          overlayPosition: getComputedStyle(overlay).position,
        };
      });
      assert(sceneState.baseWidth > 0 && sceneState.baseHeight > 0,
        'Bundled tavern SVG must be decoded before opening transactions');
      assert.equal(sceneState.overlayUrl,
        'https://assets.chronicles.shadowops.dpdns.org/stores/taberna-premium.webp');
      assert.equal(sceneState.basePosition, 'absolute');
      assert.equal(sceneState.overlayPosition, 'absolute');
      if (sceneState.overlayWidth) {
        assert(sceneState.overlayWidth >= 1500 && sceneState.overlayHeight >= 800
          && sceneState.overlayReady, 'Premium tavern panorama must decode and appear');
      } else {
        assert(!sceneState.overlayReady && sceneState.overlayOpacity === 0,
          'Failed R2 tavern art must stay hidden behind the original scene');
      }
      const rect = await room.boundingBox();
      assert.ok(rect && rect.x >= -1 && rect.x + rect.width <= width + 1 &&
        rect.y >= -1 && rect.y + rect.height <= height + 1,
        'Tavern must fit the screen: '+JSON.stringify(rect));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      // Mobile inn controls must remain legible and reachable, even when the
      // header has a long name and a separate gold counter.
      if (width <= 844) {
        const close = await room.getByRole('button', { name:'Salir de la taberna' }).boundingBox();
        assert.ok(close && close.width >= 44 && close.height >= 44,
          'Inn close target must be at least 44px: '+JSON.stringify(close));
        const heading = room.locator('.chronicles-inn__heading');
        assert.equal(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true,
          'Inn heading must not overflow horizontally');
      }
      // Capture the header BEFORE scrolling through real transactions; the
      // post-action screenshot below records the full purchase/rumor flow.
      await page.screenshot({ path:'smoke-inn-header-'+width+'.png' });
      // The secondary return action sits in the scrollable footer. On touch
      // screens it must remain thumb-sized and inside the viewport.
      if (width <= 844) {
        const returnButton = room.getByRole('button', { name: 'Volver a la calle · ESC' });
        await returnButton.scrollIntoViewIfNeeded();
        const back = await returnButton.boundingBox();
        assert.ok(back && back.width >= 44 && back.height >= 44 &&
          back.x >= -1 && back.x + back.width <= width + 1,
          'Inn footer return target must be thumb-sized and visible: '+JSON.stringify(back));
        await page.screenshot({ path:'smoke-inn-footer-'+width+'.png' });
      }
      const gold = async () => Number(await page.locator('[data-inn-gold]').innerText());
      const qty = async () => Number(await page.locator('[data-inn-food-count]').innerText());
      const purse = await gold(), foodBefore = await qty();
      const rumor = room.locator('[data-inn-action="rumor"]');
      await rumor.click();
      assert.match(await room.innerText(), /alcalde Aldric/);
      assert.equal(await gold(), purse);
      await rumor.click();
      assert.match(await room.innerText(), /cloacas/);
      await room.locator('[data-inn-action="food"]').click();
      assert.equal(await gold(), purse - 4);
      assert.equal(await qty(), foodBefore + 1);
      await room.locator('[data-inn-action="rest"]').click();
      assert.equal(await gold(), purse - 9);
      const hp = (await page.locator('[data-inn-party-hp]').innerText()).split(',').map(Number);
      assert.ok(hp.every((value) => value > 0));
      await page.screenshot({ path:'smoke-inn-room-'+width+'.png' });
      await room.getByRole('button', {name:'Salir de la taberna'}).focus();
      await page.keyboard.press('Escape');
      await room.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      assert.deepEqual(errors, []);
      console.log('OK inn room '+width+'px');
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
