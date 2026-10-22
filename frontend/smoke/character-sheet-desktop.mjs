// Real Chromium contract for the MM3 desktop character-sheet layout.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/character-sheet-desktop.html';
const browser = await chromium.launch();
const failures = [];
try {
  for (const [width, height] of [[1024,768],[1280,800],[1440,900]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      await sheet.waitFor({ state: 'visible' });
      const nav = sheet.getByRole('navigation', { name: 'Apartados de la ficha' });
      const metrics = await sheet.evaluate((element) => {
        const menu = element.querySelector('.chronicles-character-sheet__tabs').getBoundingClientRect();
        const contentElement = element.querySelector('.chronicles-character-sheet__folio-content');
        const content = contentElement.getBoundingClientRect();
        const title = element.querySelector('.chronicles-character-sheet__head').getBoundingClientRect();
        const dock = element.querySelector('.chronicles-character-sheet__party-dock').getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return { menuLeft:menu.left, menuWidth:menu.width,
          contentRight:content.right, contentWidth:content.width,
          headerHeight:title.height, dockTop:dock.top, dockBottom:dock.bottom,
          top:rect.top, bottom:rect.bottom, left:rect.left, right:rect.right,
          viewportWidth:innerWidth, viewportHeight:innerHeight,
          documentWidth:document.documentElement.scrollWidth,
          paper:getComputedStyle(contentElement).backgroundColor };
      });
      assert(metrics.menuLeft >= metrics.contentRight - 2,
        'Right nav must stay to the right of the content: ' + JSON.stringify(metrics));
      assert(metrics.menuWidth >= 140 && metrics.contentWidth >= 550,
        'Nav must stay narrow while readable content gets main width');
      assert(metrics.headerHeight < 150, 'Desktop identity header must be compact: ' + metrics.headerHeight + 'px');
      assert(metrics.dockTop > metrics.top && metrics.dockBottom <= metrics.bottom + 2,
        'Party dock must remain visible and contained: ' + JSON.stringify(metrics));
      assert(metrics.documentWidth <= width + 1 && metrics.left >= -1 && metrics.right <= width + 1,
        'No horizontal clipping on desktop');
      assert.notEqual(metrics.paper,'rgb(25, 23, 21)', 'The dossier should use light parchment');
      // Visual geometry alone misses letter collisions inside compact stats.
      const overflowingStats = await sheet.locator('.chronicles-character-sheet__mm3-stats [data-stat] span')
        .evaluateAll((labels) => labels.filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => node.textContent.trim()));
      assert.deepEqual(overflowingStats, [], 'No MM3 attribute label may overlap its value');
      assert.equal(await nav.getByRole('button').count(), 4);
      assert.equal(await nav.getByRole('button', { name: /Estado/ }).getAttribute('aria-pressed'), 'true');
      await page.screenshot({ path: 'smoke-character-sheet-desktop-' + width + '.png' });
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Equipo/ }).getAttribute('aria-pressed'), 'true');
      assert.equal(await sheet.getByText('Mochila de expedición').count(), 1);
      await nav.getByRole('button', { name: /Hechizos/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true');
      await nav.getByRole('button', { name: /Estado/ }).click();
      await sheet.getByRole('button', { name: 'Ver ficha de Aziz' }).click();
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Aziz');
      assert.equal(await sheet.getByRole('button', { name: 'Ver ficha de Aziz' }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(errors, []);
      console.log('CHRONICLES_CHARACTER_DESKTOP_OK ' + width + 'x' + height);
    } catch (error) {
      failures.push(width + ': ' + error.message);
      console.error('CHRONICLES_CHARACTER_DESKTOP_FAIL', width, error);
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
if (failures.length) throw new Error(failures.join('\n'));
