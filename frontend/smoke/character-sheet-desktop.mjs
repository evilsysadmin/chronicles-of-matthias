// Real Chromium contract for the MM3 desktop character-sheet layout.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/character-sheet-desktop.html';
const browser = await chromium.launch();
const failures = [];
let exercisedScrollableDossier = false;

async function assertParchmentSurface(locator, label) {
  const bg = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  const rgb = bg.match(/^rgba?[(]([0-9]+),[ ]*([0-9]+),[ ]*([0-9]+)/);
  assert.ok(rgb, label + ' must expose an opaque background: ' + bg);
  const [, r, g, b] = rgb.map(Number);
  assert.ok(r >= 170 && g >= 150 && b >= 105,
    label + ' must remain a light reading surface rather than legacy dark chrome: ' + bg);
}
async function assertResourceContrast(sheet, resource) {
  const chip = sheet.locator(`.chronicles-character-sheet__quick [data-resource="${resource}"]`);
  assert.equal(await chip.count(), 1, 'Expected a real ' + resource + ' resource badge');
  const ratio = await chip.evaluate((node) => {
    const rgb = (value) => (value.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
    const linear = (channel) => {
      const c = channel / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    };
    const luminance = (value) => {
      const [r, g, b] = rgb(value).map(linear);
      return r * .2126 + g * .7152 + b * .0722;
    };
    const ink = luminance(getComputedStyle(node.querySelector('b')).color);
    const paper = luminance(getComputedStyle(node).backgroundColor);
    return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
  });
  assert.ok(ratio >= 4.5, resource + ' badge must be readable on parchment; measured contrast=' + ratio.toFixed(2));
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
      if (width === 1024) {
        const statsDensity = await sheet.locator('.chronicles-character-sheet__mm3-stats')
          .evaluate((grid) => {
            const rows = [...grid.querySelectorAll('[data-stat]')];
            const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean);
            const collisions = rows.flatMap((row) => {
              const title = row.querySelector('span').getBoundingClientRect();
              const number = row.querySelector('b').getBoundingClientRect();
              return title.right > number.left + 1
                ? [{ key: row.dataset.stat, titleRight: title.right, numberLeft: number.left }]
                : [];
            });
            return { columns: columns.length, rows: rows.length, collisions };
          });
        assert.equal(statsDensity.columns, 2,
          '1024px desktop should show a compact two-column MM3 attribute sheet');
        assert.ok(statsDensity.rows >= 7, 'All real MM3 attributes must remain on the sheet');
        assert.deepEqual(statsDensity.collisions, [],
          'Attribute labels must not collide with numerical values: ' + JSON.stringify(statsDensity));
      }
      assert.equal(await nav.getByRole('button').count(), 4);
      assert.equal(await nav.getByRole('button', { name: /Estado/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Estado');
      await assertResourceContrast(sheet, 'gold');
      await page.screenshot({ path: 'smoke-character-sheet-desktop-' + width + '.png' });
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Equipo/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Equipo');
      assert.equal(await sheet.getByText('Mochila de expedición').count(), 1);
      const meleeCard = sheet.locator('.chronicles-character-sheet__weapon-card').first();
      await meleeCard.waitFor({ state: 'visible' });
      await assertParchmentSurface(meleeCard, 'Equipment weapon card');
      // Empty relics must not waste half the equipment dossier width.
      const emptyRelicLayout = await sheet.locator('.chronicles-character-sheet__loadout.is-relic-empty')
        .evaluate((node) => {
          const relicCard = node.querySelector(':scope > article:first-child').getBoundingClientRect();
          const equipmentCard = node.querySelector(':scope > .chronicles-character-sheet__equipment').getBoundingClientRect();
          return { relicHeight: relicCard.height, relicWidth: relicCard.width,
            equipmentWidth: equipmentCard.width, relicBottom: relicCard.bottom,
            equipmentTop: equipmentCard.top };
        });
      assert.ok(emptyRelicLayout.relicHeight <= 85,
        'A missing relic should occupy a compact row: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(emptyRelicLayout.equipmentWidth >= emptyRelicLayout.relicWidth - 2,
        'Equipped weapons and armour should regain the full usable width: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(emptyRelicLayout.equipmentTop >= emptyRelicLayout.relicBottom - 2,
        'Full-width equipment should appear below the compact empty relic');
      await page.screenshot({ path: 'smoke-character-sheet-equipment-' + width + '.png' });

      // MM3 inventory desk with real catalog items from the campaign reducer.
      const equipment = sheet.locator('[data-chronicles-equipment-folio]');
      const inv = equipment.locator('.chronicles-character-sheet__inventory');
      const rows = inv.locator('[data-inventory-item]');
      assert.ok(await rows.count() >= 3, 'Reward grants must populate the actual backpack');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true');
      const detail = equipment.locator('.chronicles-character-sheet__item-details');
      assert.equal(await detail.isVisible(), true, 'Item detail appears without a preliminary click');
      const firstName = await rows.first().locator('span').innerText();
      assert.ok((await detail.innerText()).includes(firstName));
      await rows.nth(1).click();
      assert.equal(await rows.nth(1).getAttribute('aria-pressed'), 'true');
      const secondName = await rows.nth(1).locator('span').innerText();
      assert.ok((await detail.innerText()).includes(secondName));
      await rows.nth(1).focus();
      await page.keyboard.press('Home');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('End');
      assert.equal(await rows.last().getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('ArrowDown');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true',
        'ArrowDown must wrap the filtered backpack without altering stock');
      assert.equal(await equipment.getByRole('button', { name: /Equipar/ }).isDisabled(), true,
        'Read-only smoke fixture cannot equip without a real game action callback');
      const desk = await Promise.all([inv.boundingBox(), detail.boundingBox()]);
      assert.ok(desk[0] && desk[1] && desk[0].x + desk[0].width <= desk[1].x + 2,
        'Desktop MM3 inventory list must stand to the left of contextual details');
      await page.screenshot({ path: 'smoke-character-sheet-inventory-' + width + '.png' });
      await nav.getByRole('button', { name: /Hechizos/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Hechizos');
      const casterShortcut = sheet.getByRole('button', { name: /Ver hechizos de/ });
      await casterShortcut.waitFor({ state: 'visible' });
      await casterShortcut.click();
      const spellbook = sheet.locator('[data-chronicles-spellbook]');
      await spellbook.waitFor({ state: 'visible' });
      const grimoire = spellbook.locator('[data-chronicles-grimoire]');
      await grimoire.waitFor({ state: 'visible' });
      await assertResourceContrast(sheet, 'magic');
      await assertResourceContrast(sheet, 'gold');
      const spellRows = grimoire.locator('[data-grimoire-spell]');
      const actualCount = await spellRows.count();
      assert.ok(actualCount >= 1, 'The real caster must have learned spells');
      assert.equal(await spellRows.first().getAttribute('aria-pressed'), 'true');
      assert.match(await grimoire.getByRole('region', { name: 'Detalle del hechizo seleccionado' }).innerText(), /PH/);
      await grimoire.getByRole('button', { name: 'Ataque' }).click();
      assert.ok((await spellRows.count()) <= actualCount, 'Filtering cannot invent spellbook entries');
      await grimoire.getByRole('button', { name: 'Todos' }).click();
      assert.equal(await spellRows.count(), actualCount);
      await spellRows.first().focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await spellRows.nth(actualCount === 1 ? 0 : 1).getAttribute('aria-pressed'), 'true',
        'ArrowDown moves spellbook selection without casting');
      await grimoire.getByRole('button', { name: 'Todos' }).focus();
      assert.notEqual(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias',
        'The shortcut must open a real spellcaster, never create spells for Matthias');
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true',
        'Switching hero should preserve the spellbook section');
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-spells-caster-' + width + '.png' });
      await sheet.getByRole('button', { name: 'Ver ficha de Matthias' }).click();
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias');
      await sheet.getByText('Este personaje no practica ninguna escuela de magia.').waitFor({ state: 'visible' });
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

      // A long Training page must not make the next dossier section open mid-scroll.
      // Exercise this only when the real fixture has a scrollable region.
      const scrollArea = sheet.locator('.chronicles-character-sheet__scroll');
      const availableScroll = await scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
      if (availableScroll > 120) {
        exercisedScrollableDossier = true;
        await scrollArea.evaluate((node) => { node.scrollTop = Math.min(220, node.scrollHeight - node.clientHeight); });
        const before = await scrollArea.evaluate((node) => node.scrollTop);
        assert.ok(before > 60, 'Fixture must actually scroll before testing reset');
        // Native click avoids Playwright scrolling the sticky menu on our behalf.
        await nav.getByRole('button', { name: /Equipo/ }).evaluate((node) => node.click());
        await page.waitForFunction(() => document.querySelector(
          '.chronicles-character-sheet__tabs button[aria-pressed="true"]'
        )?.textContent?.includes('Equipo'));
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) <= 2,
          'Changing to Equipment must return the desktop dossier to its beginning');
        await nav.getByRole('button', { name: /Mejoras/ }).click();
      }

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
assert.ok(exercisedScrollableDossier, 'At least one desktop fixture must exercise long-page scroll restoration');
