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
      const measure = () => rail.evaluate(node => {
        const heading = node.querySelector('.chronicles-initiative-rail__heading');
        const round = heading.querySelector('span');
        const turn = heading.querySelector('strong');
        const actors = [...node.querySelectorAll('li')];
        const textSize = element => parseFloat(getComputedStyle(element).fontSize);
        const measured = node.getBoundingClientRect();
        const headingBox = heading.getBoundingClientRect();
        const caption = element => {
          const rect = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            font: textSize(element),
            text: element.textContent.trim(),
            clipped: element.scrollWidth > element.clientWidth + 1
              || element.scrollHeight > element.clientHeight + 1,
            fragmentsInside: [...range.getClientRects()].every(part =>
              part.left >= headingBox.left - 1 && part.right <= headingBox.right + 1
              && part.top >= headingBox.top - 1 && part.bottom <= headingBox.bottom + 1),
            inside: rect.left >= headingBox.left - 1 && rect.right <= headingBox.right + 1
              && rect.top >= headingBox.top - 1 && rect.bottom <= headingBox.bottom + 1,
          };
        };
        return {
          left: measured.left, right: measured.right, top: measured.top,
          width: measured.width, viewportWidth: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          headingSize: textSize(turn),
          roundSize: textSize(round),
          headingWidth: headingBox.width,
          turnCaption: caption(turn),
          roundCaption: caption(round),
          names: actors.map(actor => {
            const name = actor.querySelector('b');
            const style = getComputedStyle(name);
            return {
              text: name.textContent,
              fontSize: textSize(name),
              clipped: name.scrollWidth > name.clientWidth + 1,
              availableWidth: name.clientWidth,
              requiredWidth: name.scrollWidth,
              visible: style.display !== 'none' && name.getBoundingClientRect().width > 0,
              spoken: actor.getAttribute('aria-label'),
            };
          }),
        };
      });
      const m = await measure();
      assert.equal(errors.length, 0, `JS errors at ${width}px: ${errors.join('; ')}`);
      assert.ok(m.left >= -1 && m.right <= width + 1 && !m.overflow,
        `Initiative rail must fit ${width}px: ${JSON.stringify(m)}`);
      assert.ok(m.headingSize >= (width <= 520 ? 14 : 12)
        && m.roundSize >= (width <= 520 ? 12 : 11),
        `Turn and round labels must be readable at ${width}px: ${JSON.stringify(m)}`);
      assert.equal(m.turnCaption.text, 'TURNO ENEMIGO');
      assert.match(m.roundCaption.text, /^RONDA 3$/);
      assert.ok(!m.turnCaption.clipped && !m.roundCaption.clipped
        && m.turnCaption.inside && m.turnCaption.fragmentsInside
        && m.roundCaption.inside && m.roundCaption.fragmentsInside
        && (width > 520 || m.headingWidth <= 83),
        `Enemy turn heading must fit painted text inside the existing mobile rail at ${width}px: ${JSON.stringify(m)}`);
      assert.ok(m.names[0]?.fontSize >= 13.5 && m.names[1]?.fontSize >= 13.5,
        `Active and next actor must use readable type: ${JSON.stringify(m)}`);
      assert.ok(m.names[0].visible && m.names[1].visible
        && m.names.filter(actor => actor.visible).every(actor => !actor.clipped),
        `Visible actor names must fit at ${width}px: ${JSON.stringify(m)}`);
      assert.match(m.names[0].spoken || '', /Ahora: Espectro · iniciativa 12/);
      assert.match(m.names[1].spoken || '', /Matthias · iniciativa 11/);
      if (width === 390 || width === 1280) {
        await page.screenshot({ path: `smoke-initiative-readable-${width}.png` });
      }
      // Switching from an enemy turn to a hero turn must preserve the same
      // legible heading; the label must reflect real initiative cursor state.
      await page.goto(url + '?turn=party', { waitUntil: 'domcontentloaded' });
      await rail.waitFor({ state: 'visible', timeout: 20000 });
      const party = await measure();
      assert.match(await rail.getAttribute('aria-label'), /Ronda 3\. Turno de Matthias/);
      assert.equal(party.turnCaption.text, 'TU TURNO');
      assert.ok(party.headingSize >= (width <= 520 ? 14 : 12)
        && party.roundSize >= (width <= 520 ? 12 : 11)
        && !party.turnCaption.clipped && !party.roundCaption.clipped
        && party.turnCaption.inside && party.turnCaption.fragmentsInside
        && party.roundCaption.inside && party.roundCaption.fragmentsInside
        && party.names[0].text === 'Matthias'
        && !party.overflow && party.left >= -1 && party.right <= width + 1,
        `Party turn heading must be fully readable without widening the rail at ${width}px: ${JSON.stringify(party)}`);
      if (width === 390) {
        await page.screenshot({ path: 'smoke-initiative-party-readable-390.png' });
      }
      console.log(`CHRONICLES_INITIATIVE_READABLE_OK ${width}x${height}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
