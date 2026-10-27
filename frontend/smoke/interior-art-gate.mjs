// A real Chromium regression for the one-frame interior-art contract.
// No external CDN dependency: intercept the genuine R2 URLs, delay decoding,
// and prove that even a fully loaded fallback never flashes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const shopUrl = process.argv[2] || 'http://localhost:4174/smoke/shop-room.html';
const audienceUrl = new URL('audience-room.html', shopUrl).href;
const innUrl = new URL('inn-room.html', shopUrl).href;
const remotePattern = 'https://assets.chronicles.shadowops.dpdns.org/stores/**';
const tinyPremium = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#345c54"/><circle cx="800" cy="450" r="160" fill="#eee4bc"/></svg>';
const browser = await chromium.launch();
const errors = [];

async function openRoom(path, { width, height, mode = 'delay' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: width === 390 ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  let matched = 0;
  await page.route(remotePattern, async route => {
    matched += 1;
    if (mode === 'error') return route.abort('failed');
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 5000));
    if (mode === 'delay') await new Promise(resolve => setTimeout(resolve, 950));
    return route.fulfill({
      status: 200, contentType: 'image/svg+xml',
      headers: { 'cache-control': 'no-store' }, body: tinyPremium,
    });
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  return { context, page, matched: () => matched };
}

async function assertBlackFirstFrame(page, width) {
  const loader = page.locator('[data-chronicles-interior-loading]');
  await loader.waitFor({ state: 'visible', timeout: 12000 });
  const info = await page.evaluate(() => {
    const gate = document.querySelector('[data-chronicles-interior-loading]');
    const rect = gate.getBoundingClientRect();
    const element = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      black: getComputedStyle(gate).backgroundColor,
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      onTop: Boolean(element?.closest('.chronicles-interior-loading')),
      noScroll: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  assert.equal(info.black, 'rgb(2, 3, 4)');
  assert.equal(info.left, 0);
  assert.equal(info.top, 0);
  assert.equal(info.width, width);
  assert.equal(info.height, page.viewportSize().height);
  assert.equal(info.onTop, true, 'The actual loading gate must cover room and controls');
  assert.equal(info.noScroll, true);
  assert.equal(await page.locator('.chronicles-shop__premium-art.is-ready').count(), 0);
}

async function assertPremiumReveal(page) {
  await page.locator('[data-chronicles-interior-loading]').waitFor({
    state: 'detached', timeout: 10000,
  });
  const premium = page.locator('img.chronicles-shop__premium-art');
  await premium.waitFor({ state: 'visible' });
  assert.match(await premium.getAttribute('src'), /assets\.chronicles\.shadowops\.dpdns\.org\/stores\//);
  const image = await premium.evaluate(node => ({
    loaded: node.complete && node.naturalWidth > 0,
    opacity: getComputedStyle(node).opacity,
    transition: getComputedStyle(node).transitionDuration,
  }));
  assert.equal(image.loaded, true, 'First visible premium frame is already decoded');
  assert.equal(image.opacity, '1', 'No partial-alpha flash of local fallback');
  assert.equal(image.transition, '0s', 'Do not crossfade local fallback after gate');
}

try {
  for (const width of [390, 1280]) {
    const height = width === 390 ? 844 : 800;
    for (const [fixture, path] of [
      ['shop', shopUrl + '?room=odo'],
      ['audience', audienceUrl + '?npc=ilse'],
    ]) {
      const { context, page, matched } = await openRoom(path, { width, height });
      try {
        await assertBlackFirstFrame(page, width);
        await page.waitForTimeout(160);
        assert.equal(await page.locator('[data-chronicles-interior-loading]').isVisible(), true,
          'Fallback must not flash while the premium is still downloading');
        await page.screenshot({ path: `smoke-interior-loading-${fixture}-${width}.png` });
        await assertPremiumReveal(page);
        assert.ok(matched() >= 1, 'Must exercise actual R2 image source');
        if (fixture === 'shop') {
          assert.equal(await page.getByRole('tab', { name: 'Comprar' }).isVisible(), true);
        } else {
          assert.equal(await page.getByRole('button', { name: /Salir|Volver/ }).count() > 0, true);
        }
        await page.screenshot({ path: `smoke-interior-premium-${fixture}-${width}.png` });
        console.log('OK interior atomic premium reveal', fixture, width);
      } finally {
        await context.close();
      }
    }
  }

  // Tavern uses the very same shared component, including its own scene CSS.
  {
    const { context, page } = await openRoom(innUrl, { width: 390, height: 844 });
    try {
      await assertBlackFirstFrame(page, 390);
      await assertPremiumReveal(page);
      console.log('OK inn atomic premium reveal');
    } finally { await context.close(); }
  }

  // CDN error is the ONLY reason to reveal an already-loaded local room.
  {
    const { context, page, matched } = await openRoom(shopUrl + '?room=odo',
      { width: 390, height: 844, mode: 'error' });
    try {
      await page.locator('[data-chronicles-interior-loading]').waitFor({
        state: 'detached', timeout: 10000,
      });
      assert.ok(matched() >= 1);
      assert.equal(await page.locator('.chronicles-shop__premium-art.is-ready').count(), 0);
      const fallback = page.locator('[data-chronicles-shop-art-layer="fallback"]');
      assert.equal(await fallback.evaluate(node => node.complete && node.naturalWidth > 0), true);
      assert.equal(await page.getByRole('tab', { name: 'Comprar' }).isVisible(), true);
      console.log('OK CDN failure recovers local art without blocked controls');
    } finally { await context.close(); }
  }

  // A slow/stalled CDN still offers a visible touch-sized cancellation action.
  {
    const { context, page } = await openRoom(audienceUrl + '?npc=brask',
      { width: 390, height: 844, mode: 'slow' });
    try {
      await assertBlackFirstFrame(page, 390);
      await page.getByRole('button', { name: 'Salir durante la carga' }).click();
      assert.equal(await page.locator('[data-chronicles-interior-loading]').count(), 0);
      assert.equal(await page.locator('[data-chronicles-audience]').count(), 0);
      console.log('OK slow-CDN audience cancellation');
    } finally { await context.close(); }
  }

  assert.deepEqual(errors, [], 'No uncaught exceptions in React interior loader');
} finally {
  await browser.close();
}
