import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/party-bark.html';
const browser = await chromium.launch();
const viewports = [
  { width: 1280, height: 800, touch: false },
  { width: 360, height: 780, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 430, height: 932, touch: true },
  { width: 844, height: 390, touch: true },
];

try {
  for (const { width, height, touch } of viewports) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: touch, hasTouch: touch,
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const tab = page.locator('.chronicles-party-bark__trigger');
      const detail = page.locator('.chronicles-party-bark__details');
      const action = page.getByRole('button', { name: 'Revisar equipo' });
      await tab.waitFor({ state: 'visible' });
      assert.equal(await tab.getAttribute('aria-label'), 'Comentario de Hildegard. Leer');
      assert.equal(await tab.getAttribute('aria-expanded'), 'false');
      assert.equal(await detail.isVisible(), false, 'Comment must not start expanded');

      const tabInfo = await tab.evaluate((node) => ({
        font: parseFloat(getComputedStyle(node).fontSize),
        height: node.getBoundingClientRect().height,
        width: node.getBoundingClientRect().width,
      }));
      assert.ok(tabInfo.font >= 14 && tabInfo.height >= 40
        && tabInfo.width <= Math.min(240, width - 20) + 1,
      'Readable compact speaker tab must not grow into a permanent card: ' + JSON.stringify(tabInfo));

      if (!touch) {
        await tab.hover();
        await detail.waitFor({ state: 'visible' });
        await page.mouse.move(width - 4, Math.round(height / 2));
        await detail.waitFor({ state: 'hidden' });
        await tab.focus();
        await tab.press('Enter');
      } else {
        await tab.tap();
      }

      assert.equal(await tab.getAttribute('aria-expanded'), 'true');
      await detail.waitFor({ state: 'visible' });
      // A visible panel may still be 1-5px into its 140ms translateY entrance.
      // Measure settled geometry, not a transient animation frame.
      await detail.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})));
      });
      const metrics = await detail.evaluate((node) => {
        const rect = (element) => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
        };
        const root = node.closest('.chronicles-party-bark');
        const trigger = root.querySelector('.chronicles-party-bark__trigger');
        const button = node.querySelector('.chronicles-party-bark__action');
        return {
          panel: rect(node), trigger: rect(trigger),
          copyFont: parseFloat(getComputedStyle(node.querySelector('p')).fontSize),
          copyLine: parseFloat(getComputedStyle(node.querySelector('p')).lineHeight),
          actionFont: parseFloat(getComputedStyle(button).fontSize),
          actionHeight: rect(button).height,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          maxHeight: parseFloat(getComputedStyle(node).maxHeight),
          pointerEvents: getComputedStyle(node).pointerEvents,
          controls: rect(document.querySelector('[data-smoke-touch-controls]')),
        };
      });
      assert.ok(metrics.copyFont >= 16 && metrics.copyLine >= 22
        && metrics.actionFont >= 15 && metrics.actionHeight >= 44,
        'Readable expanded dialogue and action: ' + JSON.stringify(metrics));
      assert.ok(metrics.panel.left >= -1 && metrics.panel.right <= width + 1
        && metrics.panel.top >= -1 && metrics.panel.bottom <= height + 1
        && !metrics.pageOverflow,
        'Dialogue must not escape viewport: ' + JSON.stringify(metrics));
      assert.ok(metrics.panel.bottom <= metrics.trigger.top - 6,
        'Dialogue floats above the speaker tab: ' + JSON.stringify(metrics));
      assert.ok(metrics.panel.height <= metrics.maxHeight + 1
        && metrics.pointerEvents === 'auto',
        'Opened panel scrolls inside its existing bounded area');
      if (touch) {
        assert.ok(metrics.trigger.bottom <= metrics.controls.top - 4,
          'Speaker tab must stay clear of bottom touch actions: ' + JSON.stringify(metrics));
      }
      await page.screenshot({ path: 'smoke-party-bark-readable-' + width + '.png' });

      await action.click();
      assert.equal(await page.locator('[data-smoke-open-count]').innerText(), '1',
        'Equipment callback must remain interactive after text enlargement');
      if (!touch) {
        await page.mouse.move(width - 4, Math.round(height / 2));
        await tab.focus();
        await tab.press('Escape');
      } else {
        await tab.tap();
      }
      assert.equal(await tab.getAttribute('aria-expanded'), 'false',
        'Comment can be dismissed with the existing input behavior');
      await detail.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      console.log('CHRONICLES_PARTY_BARK_READABLE_OK', width, height);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
