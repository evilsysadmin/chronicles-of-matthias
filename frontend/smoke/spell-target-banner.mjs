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
        const bounds = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect();
          const banner = rect('[data-chronicles-spell-target-banner]');
          const portraits = [...document.querySelectorAll('.chronicles-party-member')].map(el=>el.getBoundingClientRect());
          const gem = rect('.chronicles-game-menu > summary');
          return {
            banner: {left:banner.left,right:banner.right,top:banner.top,bottom:banner.bottom},
            gem:{left:gem.left,right:gem.right,top:gem.top,bottom:gem.bottom},
            firstPortraitTop:Math.min(...portraits.map(x=>x.top)),
            horizontalOverflow:document.documentElement.scrollWidth > window.innerWidth+1,
          };
        });
        const a = bounds.banner, b = bounds.gem;
        assert.ok(a.bottom <= bounds.firstPortraitTop + 2, 'Prompt must be above portraits: ' + JSON.stringify(bounds));
        assert.ok(a.left >= -1 && a.right <= width + 1 && a.top >= -1 && a.bottom <= height + 1,
          'Prompt must fit screen: ' + JSON.stringify(bounds));
        assert.ok(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom,
          'Prompt must not cover sapphire menu gem: ' + JSON.stringify(bounds));
        assert.equal(bounds.horizontalOverflow, false);
        assert.equal(await banner.getByRole('button', {name:/Cancelar selección/}).count(),1);
        if (width === 1760 && caster === 2) await page.screenshot({path:'smoke-spell-target-aziz-desktop.png'});
        await banner.getByRole('button', {name:/Cancelar selección/}).click();
        assert.equal(await banner.count(),0);
        assert.equal(await page.locator('[data-cancel-count="1"]').count(),1);
      }
      assert.deepEqual(errors,[], 'No JS error at width ' + width);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
