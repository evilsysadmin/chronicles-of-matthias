// Browser-enforced MM3 combat typography: computed sizes, full active
// names, and bounds at the same phone/landscape/desktop widths as other QA.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/initiative-legibility.html';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[360,780], [390,844], [430,932], [844,390], [1280,800]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const rail = page.locator('[data-chronicles-initiative="visible"]');
      await rail.waitFor({ state: 'visible', timeout: 20000 });
      const m = await rail.evaluate(node => {
        const heading = node.querySelector('.chronicles-initiative-rail__heading');
        const round = heading.querySelector('span');
        const turn = heading.querySelector('strong');
        const actors = [...node.querySelectorAll('li')];
        const textSize = element => parseFloat(getComputedStyle(element).fontSize);
        const measured = node.getBoundingClientRect();
        return {
          left: measured.left, right: measured.right, top: measured.top,
          width: measured.width, viewportWidth: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          headingSize: textSize(turn),
          roundSize: textSize(round),
          names: actors.map(actor => {
            const name = actor.querySelector('b');
            const style = getComputedStyle(name);
            return {
              text: name.textContent,
              fontSize: textSize(name),
              clipped: name.scrollWidth > name.clientWidth + 1,
              visible: style.display !== 'none' && name.getBoundingClientRect().width > 0,
              spoken: actor.getAttribute('aria-label'),
            };
          }),
        };
      });
      assert.equal(errors.length, 0, `JS errors at ${width}px: ${errors.join('; ')}`);
      assert.ok(m.left >= -1 && m.right <= width + 1 && !m.overflow,
        `Initiative rail must fit ${width}px: ${JSON.stringify(m)}`);
      assert.ok(m.headingSize >= 12 && m.roundSize >= 11,
        `Turn and round labels must be readable at ${width}px: ${JSON.stringify(m)}`);
      assert.ok(m.names[0]?.fontSize >= 13.5 && m.names[1]?.fontSize >= 13.5,
        `Active and next actor must use readable type: ${JSON.stringify(m)}`);
      assert.ok(m.names[0].visible && !m.names[0].clipped && !m.names[1].clipped,
        `Do not truncate primary actor names at ${width}px: ${JSON.stringify(m)}`);
      assert.match(m.names[0].spoken || '', /Ahora: Espectro · iniciativa 12/);
      assert.match(m.names[1].spoken || '', /Matthias · iniciativa 11/);
      if (width === 390 || width === 1280) {
        await page.screenshot({ path: `smoke-initiative-readable-${width}.png` });
      }
      console.log(`CHRONICLES_INITIATIVE_READABLE_OK ${width}x${height}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
