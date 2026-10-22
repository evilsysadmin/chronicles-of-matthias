// Real Chromium contract for the MM3 desktop character-sheet layout.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/character-sheet-desktop.html';
const browser = await chromium.launch();
const failures = [];

async function assertParchmentSurface(locator, label) {
  const bg = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  const rgb = bg.match(/^rgba?[(]([0-9]+),[ ]*([0-9]+),[ ]*([0-9]+)/);
  assert.ok(rgb, label + ' must expose an opaque background: ' + bg);
  const [, r, g, b] = rgb.map(Number);
  assert.ok(r >= 170 && g >= 150 && b >= 105,
    label + ' must remain a light reading surface rather than legacy dark chrome: ' + bg);
}
async function assertNavigationHighlight(nav, expected) {
  const buttons = await nav.locator('button').evaluateAll((nodes) => nodes.map((node) => {
    const channels = (getComputedStyle(node).backgroundColor.match(/[0-9]+/g) || [])
      .slice(0, 3).map(Number);
    return {
      name: node.textContent.trim(),
      selected: node.getAttribute('aria-pressed') === 'true',
      activeClass: node.classList.contains('is-active'),
      brightness: channels.length === 3
        ? channels[0] * .299 + channels[1] * .587 + channels[2] * .114
        : null,
    };
  }));
  const selected = buttons.filter((button) => button.selected);
  assert.equal(selected.length, 1, 'Exactly one selected folio: ' + JSON.stringify(buttons));
  assert.match(selected[0].name, new RegExp(expected));
  assert.equal(selected[0].activeClass, true, 'The visual selected class must match aria-pressed');
  for (const other of buttons.filter((button) => !button.selected)) {
    assert.equal(other.activeClass, false, 'A previous folio must not remain visually active');
    assert.ok(other.brightness != null && selected[0].brightness != null
      && other.brightness - selected[0].brightness > 30,
    'Selected tab must be visually darker than inactive tabs: ' + JSON.stringify(buttons));
  }
}

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
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Estado');
      await page.screenshot({ path: 'smoke-character-sheet-desktop-' + width + '.png' });
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Equipo/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Equipo');
      assert.equal(await sheet.getByText('Mochila de expedición').count(), 1);
      const meleeCard = sheet.locator('.chronicles-character-sheet__weapon-card').first();
      await meleeCard.waitFor({ state: 'visible' });
      await assertParchmentSurface(meleeCard, 'Equipment weapon card');
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-equipment-' + width + '.png' });

      await nav.getByRole('button', { name: /Hechizos/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Hechizos');
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-spells-' + width + '.png' });

      await nav.getByRole('button', { name: /Mejoras/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Mejoras/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Mejoras');
      const attributeCard = sheet.locator('.chronicles-character-sheet__attribute-grid > button').first();
      const skillCard = sheet.locator('.chronicles-character-sheet__skill-grid > button').first();
      await attributeCard.waitFor({ state: 'visible' });
      await skillCard.waitFor({ state: 'visible' });
      await assertParchmentSurface(attributeCard, 'Training attribute card');
      await assertParchmentSurface(skillCard, 'Training skill card');
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-training-' + width + '.png' });

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
