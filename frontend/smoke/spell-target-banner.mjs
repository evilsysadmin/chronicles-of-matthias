// Actual MM3 styles and the production target-banner component in Chromium.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4174/smoke/spell-target-banner.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[390,844],[430,844],[800,440],[1024,768],[1280,800],[1760,870]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    try {
      for (let caster = 0; caster < 4; caster++) {
        await page.goto(url + '?caster=' + caster, { waitUntil: 'domcontentloaded' });
        const banner = page.locator('[data-chronicles-spell-target-banner]');
        await banner.waitFor({ state: 'visible', timeout: 20000 });
        // A real browser layout regression: opening Primeros auxilios must
        // NOT grow the fixed-height six-portrait row or shrink the view.
        const measure = () => page.evaluate(() => {
          const box = el => {
            const {left, right, top, bottom, height} = el.getBoundingClientRect();
            return {left, right, top, bottom, height};
          };
          const banner = document.querySelector('[data-chronicles-spell-target-banner]');
          const portraits = [...document.querySelectorAll('.chronicles-party-member')].map(box);
          return {
            banner: banner ? box(banner) : null,
            gem: box(document.querySelector('.chronicles-game-menu > summary')),
            party: box(document.querySelector('.chronicles-party')),
            stage: box(document.querySelector('.chronicles-stage')),
            portraits,
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        const withPrompt = await measure();
        const a = withPrompt.banner, b = withPrompt.gem;
        const firstPortraitTop = Math.min(...withPrompt.portraits.map(x => x.top));
        const lastPortraitBottom = Math.max(...withPrompt.portraits.map(x => x.bottom));
        const compact = width <= 800 || (width <= 1024 && height <= 600);
        assert.ok(compact ? a.top >= lastPortraitBottom - 2 : a.bottom <= firstPortraitTop + 2,
          'Prompt must sit beside the strip, never cover portraits: ' + JSON.stringify(withPrompt));
        assert.ok(a.left >= -1 && a.right <= width + 1 && a.top >= -1 && a.bottom <= height + 1,
          'Prompt must fit screen: ' + JSON.stringify(withPrompt));
        assert.ok(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom,
          'Prompt must not cover sapphire menu gem: ' + JSON.stringify(withPrompt));
        assert.equal(withPrompt.horizontalOverflow, false);
        assert.equal(await banner.getByRole('button', {name:/Cancelar selección/}).count(), 1);
        if (width === 1760 && caster === 2) await page.screenshot({path:'smoke-spell-target-aziz-desktop.png'});
        if (width === 390 && caster === 2) await page.screenshot({path:'smoke-spell-target-aziz-mobile.png'});
        await banner.getByRole('button', {name:/Cancelar selección/}).click();
        assert.equal(await banner.count(), 0);
        assert.equal(await page.locator('[data-cancel-count="1"]').count(), 1);
        const withoutPrompt = await measure();
        assert.equal(withoutPrompt.horizontalOverflow, false);
        // Reflow is the exact bug in the screenshot: assert geometry before
        // and after dismissing the selector, not merely that the text fits.
        const stable = (before, after, label) => {
          for (const edge of ['left', 'right', 'top', 'bottom', 'height']) {
            assert.ok(Math.abs(before[edge] - after[edge]) <= 1,
              label + ' shifted at ' + edge + ': ' + JSON.stringify({before, after, width, caster}));
          }
        };
        stable(withPrompt.party, withoutPrompt.party, 'Party strip');
        stable(withPrompt.stage, withoutPrompt.stage, 'First-person viewport');
        assert.equal(withPrompt.portraits.length, withoutPrompt.portraits.length);
        withPrompt.portraits.forEach((portrait, i) => {
          stable(portrait, withoutPrompt.portraits[i], 'Hero ' + (i + 1));
          assert.ok(portrait.top >= -1 && portrait.bottom <= height + 1,
            'Hero portrait clipped by spell selection: ' + JSON.stringify({portrait, width, caster}));
        });
      }
      assert.deepEqual(errors,[], 'No JS error at width ' + width);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
