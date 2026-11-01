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
  const ratios = await chip.evaluate((node) => {
    const rgb = (value) => (value.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
    const linear = (channel) => {
      const c = channel / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    };
    const luminance = (value) => {
      const [r, g, b] = rgb(value).map(linear);
      return r * .2126 + g * .7152 + b * .0722;
    };
    const paper = luminance(getComputedStyle(node).backgroundColor);
    const contrast = (element) => {
      const ink = luminance(getComputedStyle(element).color);
      return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
    };
    return { label: contrast(node), value: contrast(node.querySelector('b')) };
  });
  for (const [part, ratio] of Object.entries(ratios)) {
    assert.ok(ratio >= 4.5,
      resource + ' ' + part + ' must have readable contrast on parchment; measured=' + ratio.toFixed(2));
  }
}

async function assertReadableMM3Level(sheet, viewport) {
  const painted = await sheet.evaluate((node) => {
    const identity = node.querySelector('.chronicles-character-sheet__identity');
    const level = node.querySelector('[data-chronicles-character-level]');
    const header = node.querySelector('.chronicles-character-sheet__head');
    const close = header?.querySelector('button[aria-label="Cerrar ficha"]');
    if (!identity || !level || !close) return null;
    const value = level.querySelector('strong');
    const rect = level.getBoundingClientRect();
    const identityRect = identity.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const css = getComputedStyle(level);
    return {
      label: level.getAttribute('aria-label'),
      text: level.textContent.trim(),
      number: value?.textContent.trim(),
      fontSize: parseFloat(css.fontSize),
      visible: css.visibility !== 'hidden' && css.display !== 'none' && rect.width > 0,
      clipped: level.scrollWidth > level.clientWidth + 1,
      insideIdentity: rect.left >= identityRect.left - 2 && rect.right <= identityRect.right + 2,
      insideHeader: rect.top >= headerRect.top - 2 && rect.bottom <= headerRect.bottom + 2,
      overlapsClose: rect.left < closeRect.right && rect.right > closeRect.left
        && rect.top < closeRect.bottom && rect.bottom > closeRect.top,
    };
  });
  assert.ok(painted && painted.visible && painted.fontSize >= 14
    && painted.label === 'Nivel 1' && painted.number === '1'
    && painted.text === 'Nivel 1'
    && !painted.clipped && painted.insideIdentity && painted.insideHeader
    && !painted.overlapsClose,
  'The real MM3 level must be clearly visible, unclipped and never overlap close at '
    + viewport + ': ' + JSON.stringify(painted));
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

async function measureMM3ChapterTabGeometry(nav) {
  return nav.evaluate((element) => {
    const rail = element.getBoundingClientRect();
    return {
      railLeft: rail.left,
      railWidth: rail.width,
      buttons: [...element.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    };
  });
}

async function assertMM3ChapterTabsStable(nav, initial, chapter, viewport) {
  const current = await measureMM3ChapterTabGeometry(nav);
  const message = chapter + ' must preserve all Estado tab dimensions at ' + viewport
    + ': ' + JSON.stringify({ initial, current });
  assert.equal(current.buttons.length, 3, message);
  assert.ok(Math.abs(current.railLeft - initial.railLeft) <= 3
    && Math.abs(current.railWidth - initial.railWidth) <= 1, message);
  current.buttons.forEach((button, index) => {
    assert.ok(button.height >= 55 && button.width >= 100, message);
    assert.ok(Math.abs(button.width - initial.buttons[index].width) <= 1
      && Math.abs(button.height - initial.buttons[index].height) <= 1, message);
    assert.ok(Math.abs(button.width - current.buttons[0].width) <= 1
      && Math.abs(button.height - current.buttons[0].height) <= 1, message);
  });
}

try {
  // With browser zoom, a 1280px-wide desktop can have only 690 CSS pixels
  // of height. Before the fix, the full-width V3 ledger fell back to the
  // archive's half-empty two-column folio despite ample horizontal space.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 690 } });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      const metrics = await sheet.evaluate((node) => {
        const content = node.querySelector('[data-chronicles-chapter="record"]');
        const stats = content.querySelector('.chronicles-character-sheet__section--core-stats');
        const battle = content.querySelector('.chronicles-character-sheet__vitals');
        const ledger = content.querySelector('.chronicles-character-sheet__mm3-stats');
        const frame = node.getBoundingClientRect();
        return {
          contentWidth: content.getBoundingClientRect().width,
          statsWidth: stats.getBoundingClientRect().width,
          battleWidth: battle.getBoundingClientRect().width,
          columns: getComputedStyle(ledger).gridTemplateColumns.split(' ').filter(Boolean).length,
          clippedLabels: [...ledger.querySelectorAll('[data-stat] span, [data-stat] small')]
            .filter((text) => text.scrollWidth > text.clientWidth + 2)
            .map((text) => text.textContent.trim()),
          frameLeft: frame.left,
          frameRight: frame.right,
        };
      });
      assert.ok(metrics.contentWidth >= 850
        && metrics.statsWidth >= metrics.contentWidth - 40
        && metrics.battleWidth >= metrics.contentWidth - 40,
      'Zoomed desktop Status must fill the available horizontal workspace: ' + JSON.stringify(metrics));
      assert.equal(metrics.columns, 4,
        'Zoomed desktop must keep the four readable MM3 attribute columns');
      assert.deepEqual(metrics.clippedLabels, [],
        'Zoomed desktop must not clip attribute names or descriptions');
      assert.ok(metrics.frameLeft <= 12 && metrics.frameRight >= 1268,
        'The decorated MM3 frame must reach the safe-area viewport edges: ' + JSON.stringify(metrics));
      await page.screenshot({ path: 'smoke-character-sheet-status-zoomed-1280.png' });
      console.log('CHRONICLES_CHARACTER_STATUS_ZOOMED_OK 1280x690');
    } finally {
      await ctx.close();
    }
  }
  for (const [width, height] of [[1024,768],[1280,800],[1440,900],[1760,870]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      await sheet.waitFor({ state: 'visible' });
      await assertReadableMM3Level(sheet, width + 'x' + height);
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
      assert(metrics.headerHeight <= 82, 'MM3 identity must be a compact strip, not a portrait cover: ' + metrics.headerHeight + 'px');
      assert.equal(await sheet.locator('.chronicles-character-sheet__head .chronicles-character-sheet__portrait').count(), 0,
        'Do not duplicate the permanent party-dock portrait');
      const xpHeight = await sheet.locator('.chronicles-character-sheet__progression')
        .evaluate((node) => node.getBoundingClientRect().height);
      assert(xpHeight <= 36, 'XP cannot steal workbench height: ' + xpHeight);
      const partyDock = sheet.getByRole('navigation', { name: 'Seleccionar personaje de la compañía' });
      assert.equal(await partyDock.locator('img').count(), 4, 'Four compact hero portraits remain visible on desktop');
      assert.equal(await partyDock.locator('img').first().isVisible(), true);
      assert.equal(await partyDock.locator('button').count(), 4,
        'All four characters must remain directly selectable');
      const partyDockHeight = await partyDock.evaluate((node) => node.getBoundingClientRect().height);
      assert.ok(partyDockHeight >= 72 && partyDockHeight <= 112,
        'Portraits must fit inside a compact persistent hero dock: ' + partyDockHeight);
      assert.equal(await partyDock.locator('button[aria-pressed="true"]').count(), 1);
      for (const name of ['Matthias', 'Hildegard', 'Aziz', 'Faust']) {
        const tab = partyDock.getByRole('button', { name: new RegExp('Ver ficha de ' + name) });
        assert.equal(await tab.count(), 1, 'Each hero remains selectable: ' + name);
        assert.equal(await tab.locator('.chronicles-character-sheet__party-hp').isVisible(), true,
          'Live HP remains visible in compact selector: ' + name);
      }
      // A hero button must never move under the cursor or flicker at its edge.
      // Test painted geometry, not only declarations in the CSS source.
      if (width === 1280) {
        for (const button of await partyDock.locator('button').all()) {
          const before = await button.boundingBox();
          await button.hover({ position: { x: 3, y: Math.max(3, before.height / 2) } });
          await page.waitForTimeout(200);
          const after = await button.boundingBox();
          assert.ok(after && Math.abs(after.x - before.x) < .3
            && Math.abs(after.y - before.y) < .3
            && Math.abs(after.width - before.width) < .3
            && Math.abs(after.height - before.height) < .3,
          'Hover must not move or resize hero hit targets: '
            + JSON.stringify({ before, after }));
          const transform = await button.evaluate((node) => getComputedStyle(node).transform);
          assert.equal(transform, 'none', 'Hero hover must not use transform-based movement');
        }
        await page.mouse.move(0, 0);
      }
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
      if (width >= 1200) {
        // The old dashboard was two equally dominant gear/stats panels.
        // Assert the *painted* classic ledger hierarchy, not merely CSS text.
        const ledger = await sheet.evaluate((node) => {
          const content = node.querySelector('[data-chronicles-chapter="record"]');
          const stats = content.querySelector('.chronicles-character-sheet__section--core-stats');
          const battle = content.querySelector('.chronicles-character-sheet__vitals');
          const statGrid = content.querySelector('.chronicles-character-sheet__mm3-stats');
          const columns = getComputedStyle(statGrid).gridTemplateColumns.split(' ').filter(Boolean).length;
          const labels = [...statGrid.querySelectorAll('[data-stat]')].map((el) => ({
            name: el.dataset.stat, clipped: el.scrollWidth > el.clientWidth + 2,
          }));
          const battleColumns = getComputedStyle(battle).gridTemplateColumns.split(' ').filter(Boolean).length;
          const rect = (el) => {
            const box = el.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width };
          };
          const battleCells = [...battle.children].map((el) => {
            const box = el.getBoundingClientRect();
            const text = [...el.querySelectorAll('span,b')].map((label) => ({
              value: label.textContent.trim(), clipped: label.scrollWidth > label.clientWidth + 1,
              left: label.getBoundingClientRect().left, right: label.getBoundingClientRect().right,
            }));
            return { left: box.left, right: box.right, text };
          });
          return { content: rect(content), stats: rect(stats), battle: rect(battle),
            statColumns: columns, battleColumns, battleCells, labels,
            duplicatedEquipment: content.querySelectorAll('[data-chronicles-worn-gear]').length };
        });
        assert.equal(ledger.statColumns, 4,
          'Classic MM3 status must be a full-width four-column ledger: ' + JSON.stringify(ledger));
        assert.equal(ledger.duplicatedEquipment, 0,
          'Estado must not duplicate equipped gear; all equipment controls live in Equipo');
        assert.equal(ledger.labels.length, 8,
          'All seven MM3 attributes plus the real HP condition must be present');
        assert.deepEqual(ledger.labels.filter((item) => item.clipped), [],
          'The attribute labels must not overflow: ' + JSON.stringify(ledger));
        assert.ok(ledger.stats.width >= ledger.content.width - 40
          && ledger.battle.width >= ledger.content.width - 40,
          'Both statistics and combat must fill the whole dossier, not a half-width implicit grid: '
            + JSON.stringify(ledger));
        assert.ok(ledger.battle.bottom <= ledger.stats.top + 2,
          'Combat strip comes first, then full-width attribute ledger: ' + JSON.stringify(ledger));
        assert.equal(ledger.battleColumns, 5,
          'The five visible combat metrics must occupy five equal columns, not leave a phantom sixth');
        assert.equal(ledger.battleCells.length, 5);
        assert.ok(ledger.battleCells.every((item) => item.left >= ledger.content.left - 2
          && item.right <= ledger.content.right + 2
          && item.text.every((label) => !label.clipped && label.left >= ledger.content.left - 2
            && label.right <= ledger.content.right + 2)),
          'HP, initiative, damage, hit and armor must be fully legible within the left and right edges: '
            + JSON.stringify(ledger));
      }
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
      assert.equal(await nav.getByRole('button').count(), 3);
      assert.equal(await nav.getByRole('button', { name: /Mejoras/ }).count(), 0,
        'MM3 has three classic chapters; its old Tactics training tree is gone');
      assert.equal(await nav.getByRole('button', { name: /Estado/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Estado');
      const initialChapterTabs = width >= 1200
        ? await measureMM3ChapterTabGeometry(nav) : null;
      if (initialChapterTabs) {
        await assertMM3ChapterTabsStable(nav, initialChapterTabs, 'Estado', width + 'x' + height);
      }
      await assertResourceContrast(sheet, 'gold');
      await page.screenshot({ path: 'smoke-character-sheet-desktop-' + width + '.png' });
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Equipo/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Equipo');
      if (initialChapterTabs) {
        await assertMM3ChapterTabsStable(nav, initialChapterTabs, 'Equipo', width + 'x' + height);
      }
      // The classic equipment skin must not hide the only close button with
      // its large identity banner. Exercise painted and accessible geometry.
      const equipmentClose = sheet.getByRole('button', { name: 'Cerrar ficha' });
      assert.equal(await equipmentClose.count(), 1, 'Equipment needs one accessible close control');
      const equipmentCloseBox = await equipmentClose.boundingBox();
      assert.ok(equipmentCloseBox && equipmentCloseBox.width >= 38 && equipmentCloseBox.height >= 38,
        'Equipment close must be a visible clickable target: ' + JSON.stringify(equipmentCloseBox));
      assert.equal(await equipmentClose.isEnabled(), true);
      assert.match(await sheet.locator(
        '[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head span'
      ).first().textContent(), /OBJETOS DE Matthias/,
        'Equipment must identify its current owner without duplicating headers');
      const equipment = sheet.locator('[data-chronicles-equipment-folio]');
      assert.equal(await equipment.getByRole('button', { name: 'Detalles', exact: true }).count(), 0,
        'Single Examinar owns object stats; duplicate Detalles no longer exists');
      assert.equal(await equipment.locator('#chronicles-equipment-technical-details').count(), 0);
      assert.equal(await equipment.getByText('Equipo puesto', { exact: true }).count(), 0);
      const geometry = await sheet.evaluate((node) => {
        const parent = node.querySelector('[data-chronicles-equipment-folio]');
        const loadout = parent.querySelector('.chronicles-character-sheet__loadout');
        const bag = parent.querySelector('.chronicles-character-sheet__backpack');
        const list = parent.querySelector('.chronicles-character-sheet__inventory');
        const actions = parent.querySelector('.chronicles-character-sheet__classic-actions');
        const dock = node.querySelector('.chronicles-character-sheet__party-dock');
        const rect = (el) => {
          const box = el.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right,
            width: box.width, height: box.height };
        };
        return { parent: rect(parent), loadout: rect(loadout), bag: rect(bag),
          list: rect(list), actions: rect(actions), dock: rect(dock),
          relicCount: loadout.querySelectorAll(':scope > .chronicles-character-sheet__relic').length,
          extraArticleCount: loadout.querySelectorAll(':scope > .chronicles-character-sheet__equipment').length };
      });
      assert.equal(geometry.relicCount, 0,
        'Empty relic should never insert blank space into the equipment ledger');
      assert.equal(geometry.extraArticleCount, 0,
        'Advanced gear section is absent until explicitly requested');
      assert.ok(geometry.list.width >= geometry.parent.width - 50
        && geometry.actions.width >= geometry.bag.width - 20,
        'Inventory and five commands must fill the reading column: ' + JSON.stringify(geometry));
      assert.ok(geometry.list.height >= 240
        && geometry.list.bottom <= geometry.actions.top + 3
        && geometry.actions.bottom <= geometry.dock.top + 4
        && geometry.loadout.bottom >= geometry.dock.top - 55,
        'The list must grow into the free height without hiding the actions or dock: '
          + JSON.stringify(geometry));
      // The right navigation rail must extend to the bottom of the available
      // workbench, while the outer frame nearly reaches the viewport edge.
      const rail = await sheet.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const nav = node.querySelector('.chronicles-character-sheet__tabs').getBoundingClientRect();
        const folio = node.querySelector('.chronicles-character-sheet__folio-layout').getBoundingClientRect();
        return { outerLeft: box.left, outerRight: box.right,
          navBottom: nav.bottom, folioBottom: folio.bottom, navWidth: nav.width };
      });
      assert.ok(rail.outerLeft <= 12 && rail.outerRight >= width - 12,
        'Equipment frame must reclaim black outer gutters: ' + JSON.stringify(rail));
      assert.ok(rail.navBottom >= rail.folioBottom - 4 && rail.navWidth <= 200,
        'Equipment rail must fill its height without wasting reading width: ' + JSON.stringify(rail));
      await page.screenshot({ path: 'smoke-character-sheet-equipment-' + width + '.png' });

      // MM3 inventory desk with real catalog items from the campaign reducer.

      assert.equal(await equipment.locator('.chronicles-character-sheet__bag-transfer').count(), 0,
        'Manual handoff must not duplicate the 1–4 party dock with a recipient form');
      assert.equal(await equipment.getByRole('button', { name: 'Repartir botín' }).count(), 0,
        'Players move chosen items manually instead of using automatic redistribution');
      const inv = equipment.locator('.chronicles-character-sheet__inventory');
      const rows = inv.locator('[data-inventory-item]');
      assert.ok(await rows.count() >= 3, 'Reward grants must populate the actual backpack');
      const density = await inv.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const rows = [...node.querySelectorAll('[data-inventory-item]')];
        const boxes = rows.map((button) => button.getBoundingClientRect());
        return {
          count: rows.length,
          firstRowHeight: boxes[0].height,
          visible: boxes.filter((box) => box.top >= rect.top && box.bottom <= rect.bottom - 2).length,
          listHeight: rect.height,
          horizontalOverflow: node.scrollWidth > node.clientWidth + 1,
        };
      });
      assert.ok(density.firstRowHeight >= 44 && density.firstRowHeight <= 50,
        'Items must remain compact with minimum 44px targets: ' + JSON.stringify(density));
      assert.equal(density.horizontalOverflow, false, 'Inventory must not overflow sideways');
      if (width >= 1200) {
        assert.ok(density.visible >= Math.min(5, density.count),
          'Five objects should be visible without scrolling whenever five exist: '
          + JSON.stringify(density));
      }

      if (width === 1280) {
        const labelWidth = await rows.first().locator('span').evaluate(
          (node) => node.getBoundingClientRect().width);
        assert.ok(labelWidth >= 120,
          '1280px inventory labels must have enough width for words, not letters: ' + labelWidth);
      }
      assert.equal(await rows.first().getAttribute('title'),
        await rows.first().locator('span').innerText(),
        'An ellipsized item keeps its full name available on hover');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'false',
        'Initial first-item preview does not silently select an item for transfer');
      const actions = equipment.getByRole('navigation', { name: 'Acciones de inventario' });
      assert.equal(await actions.locator('button').count(), 5,
        'Classic item menu has five commands; 1–4 still transfers directly');
      const detail = equipment.locator('.chronicles-character-sheet__item-details');
      assert.equal(await detail.isVisible(), false,
        'Item details stay hidden until Examinar');
      assert.equal(await actions.getByRole('button', { name: /Equipar/ }).isDisabled(), true,
        'Unselected preview must never trigger equipment');
      await rows.first().click();
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true');
      await actions.getByRole('button', { name: /Examinar/ }).click();
      // A separate small modal must not resize the underlying full-width
      // ledger or obscure an actual stats row in its own scrollable card.
      assert.equal(await detail.isVisible(), true);
      assert.equal(await detail.getAttribute('role'), 'dialog');
      assert.equal(await detail.getAttribute('aria-modal'), 'true');
      const modalGeometry = await equipment.evaluate((node) => {
        const rect = (sel) => node.querySelector(sel).getBoundingClientRect();
        const list = rect('.chronicles-character-sheet__inventory');
        const bag = rect('.chronicles-character-sheet__backpack');
        const popup = rect('.chronicles-character-sheet__item-details');
        const scrim = rect('.chronicles-character-sheet__inspection-scrim');
        const dialog = node.querySelector('.chronicles-character-sheet__item-details');
        return { listWidth: list.width, bagWidth: bag.width, listHeight: list.height,
          popupWidth: popup.width, popupHeight: popup.height, popupX: popup.x,
          popupY: popup.y, scrimWidth: scrim.width, scrimHeight: scrim.height,
          contentScroll: dialog.scrollHeight > dialog.clientHeight + 2,
          headerColor: getComputedStyle(dialog.querySelector('.chronicles-character-sheet__inspection-head')).backgroundColor };
      });
      assert.ok(modalGeometry.listWidth >= modalGeometry.bagWidth - 22
        && modalGeometry.listHeight >= 100
        && modalGeometry.popupWidth <= 640
        && modalGeometry.popupHeight < modalGeometry.scrimHeight
        && modalGeometry.popupX >= 0 && modalGeometry.popupY >= 0,
        'Centered inspection must preserve the full inventory and fit the viewport: '
          + JSON.stringify(modalGeometry));
      assert.equal(modalGeometry.contentScroll, false,
        'Desktop Examinar must show all real attributes without internal scrolling: '
          + JSON.stringify(modalGeometry));
      assert.equal(modalGeometry.headerColor, 'rgb(57, 75, 76)',
        'The object dossier must use the same slate/sage visual language as the character sheet');
      assert.equal(await detail.getByRole('button', { name: 'Cerrar inspección' }).evaluate((node) => document.activeElement === node), true,
        'Modal entry must focus its own close button');
      const more = detail.locator('.chronicles-character-sheet__item-more');
      assert.equal(await more.evaluate((node) => node.open), true,
        'Examinar must expose real damage and bonuses without another disclosure');
      assert.equal(await more.locator('dl').isVisible(), true);
      await more.locator('summary').click();
      assert.equal(await more.evaluate((node) => node.open), false,
        'Players can still fold the long details');
      await more.locator('summary').click();
      assert.equal(await more.evaluate((node) => node.open), true);

      await page.keyboard.press('Tab');
      assert.equal(await detail.evaluate((node) => node.contains(document.activeElement)), true,
        'Tab must remain inside the inspection modal');
      await page.keyboard.press('Escape');
      assert.equal(await detail.isVisible(), false,
        'Escape closes only the inspection, leaving the character sheet intact');
      assert.equal(await actions.getByRole('button', { name: /Examinar/ }).evaluate((node) => document.activeElement === node), true,
        'Closing inspection restores the previous inventory command');
      assert.equal(await sheet.isVisible(), true);
      // No second inspector panel: MM3 always shows every owned item,
      // including equipped gear, without hidden category/search state.
      assert.equal(await equipment.locator('.chronicles-character-sheet__backpack-tools').count(), 0);
      assert.equal(await equipment.locator('input[type="search"]').count(), 0);
      assert.ok(await inv.locator('[data-ledger-id]').count() >= await rows.count(),
        'Unified ledger preserves all bag rows along with real equipped objects');
      const firstName = await rows.first().locator('span').innerText();
      await actions.getByRole('button', { name: /Examinar/ }).click();
      assert.ok((await detail.textContent()).includes(firstName));
      await detail.getByRole('button', { name: 'Cerrar inspección' }).click();
      await rows.nth(1).click();
      assert.equal(await rows.nth(1).getAttribute('aria-pressed'), 'true');
      const secondName = await rows.nth(1).locator('span').innerText();
      await actions.getByRole('button', { name: /Examinar/ }).click();
      assert.ok((await detail.textContent()).includes(secondName));
      await page.keyboard.press('i');
      assert.equal(await detail.isVisible(), false, 'I toggles off only the inspection');
      await rows.nth(1).focus();
      await page.keyboard.press('Home');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('End');
      assert.equal(await rows.last().getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('ArrowDown');
      assert.equal(await rows.first().getAttribute('aria-pressed'), 'true',
        'ArrowDown must wrap the complete inventory without altering stock');
      assert.equal(await equipment.getByRole('button', { name: /Equipar/ }).isDisabled(), true,
        'Read-only smoke fixture cannot equip without a real game action callback');
      await actions.getByRole('button', { name: /Examinar/ }).click();
      assert.equal(await detail.isVisible(), true);
      assert.ok((await detail.boundingBox()).width <= 640,
        'Keyboard-opened inspection is still a compact floating window');
      await page.screenshot({ path: 'smoke-character-sheet-inventory-' + width + '.png' });
      await detail.getByRole('button', { name: 'Cerrar inspección' }).click();
      // The unfiltered list survives chapter navigation without losing items.
      const visibleIds = await inv.locator('[data-ledger-id]')
        .evaluateAll((entries) => entries.map((entry) => entry.dataset.ledgerId));
      assert.ok(visibleIds.length >= 3, 'The actual bag has more than one category of object');
      await nav.getByRole('button', { name: /Estado/ }).click();
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert.deepEqual(await inv.locator('[data-ledger-id]')
        .evaluateAll((entries) => entries.map((entry) => entry.dataset.ledgerId)), visibleIds,
      'Switching folios must not filter, hide or reorder real possessions');

      await nav.getByRole('button', { name: /Hechizos/ }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true');
      await page.mouse.move(10, 10);
      await assertNavigationHighlight(nav, 'Hechizos');
      if (initialChapterTabs) {
        await assertMM3ChapterTabsStable(nav, initialChapterTabs, 'Hechizos', width + 'x' + height);
      }
      // Non-casters remain on their own sheet: no cross-hero magic CTA.
      const nonCaster = sheet.locator('.chronicles-character-sheet__no-spells');
      await nonCaster.waitFor({ state: 'visible' });
      assert.match(await nonCaster.innerText(), /Este personaje no practica magia/);
      assert.equal(await sheet.getByRole('button', { name: /Ver hechizos de/ }).count(), 0);
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias');
      const visibleLevel = sheet.locator('[data-chronicles-character-level]');
      await visibleLevel.waitFor({ state: 'visible' });
      assert.equal(await visibleLevel.getAttribute('aria-label'), 'Nivel 1');
      // Change heroes explicitly through the persistent party dock, as MM3 does.
      await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' }).click();
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Hildegard');
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true');
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
      assert.deepEqual(await spellRows.evaluateAll((nodes) =>
        nodes.map((node) => node.tabIndex)),
        Array.from({ length: actualCount }, (_, index) => index === 0 ? 0 : -1),
        'Exactly one spell should be reachable by Tab, with arrows navigating the rest');
      const spellInspector = grimoire.locator('.chronicles-sheet-grimoire__detail');
      const inspectSpell = grimoire.getByRole('button', { name: /Examinar/ });
      assert.equal(await spellInspector.isVisible(), false,
        'Spell details must not take half the catalogue until Examinar is requested');
      const spellGeometry = await grimoire.evaluate((node) => {
        const bounds = (selector) => node.querySelector(selector).getBoundingClientRect();
        const panel = node.getBoundingClientRect();
        const list = bounds('.chronicles-sheet-grimoire__list');
        const catalog = bounds('.chronicles-sheet-grimoire__catalog');
        const nav = document.querySelector('.chronicles-character-sheet__tabs').getBoundingClientRect();
        return { panelWidth: panel.width, listWidth: list.width,
          catalogWidth: catalog.width, listHeight: list.height, navWidth: nav.width };
      });
      assert.ok(spellGeometry.listWidth >= spellGeometry.panelWidth - 22
        && spellGeometry.catalogWidth >= spellGeometry.panelWidth - 8
        && spellGeometry.listHeight >= 110
        && spellGeometry.navWidth <= 200,
        'Spellbook must fill its workbench, like Equipment: ' + JSON.stringify(spellGeometry));
      await inspectSpell.click();
      assert.equal(await spellInspector.isVisible(), true);
      assert.equal(await spellInspector.getAttribute('role'), 'dialog');
      assert.equal(await spellInspector.getAttribute('aria-modal'), 'true');
      assert.match(await spellInspector.innerText(), /PH/);
      assert.equal(await spellInspector.getByRole('button', { name: 'Cerrar inspección de hechizo' })
        .evaluate((node) => document.activeElement === node), true,
        'Inspect must focus its close button');
      const opened = await grimoire.evaluate((node) => {
        const list = node.querySelector('.chronicles-sheet-grimoire__list').getBoundingClientRect();
        const popup = node.querySelector('.chronicles-sheet-grimoire__detail').getBoundingClientRect();
        return { listWidth: list.width, listHeight: list.height, popupWidth: popup.width, popupHeight: popup.height,
          popupLeft: popup.left, popupTop: popup.top };
      });
      assert.ok(opened.listWidth >= spellGeometry.listWidth - 2
        && opened.popupWidth <= 640 && opened.popupHeight > 100
        && opened.popupLeft >= 0 && opened.popupTop >= 0,
        'Inspect must float over the unchanged full-width catalogue: ' + JSON.stringify(opened));
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-spell-inspect-' + width + '.png' });
      await page.keyboard.press('Tab');
      assert.equal(await spellInspector.evaluate((node) => node.contains(document.activeElement)), true,
        'Tab must stay inside the spell inspector');
      await page.keyboard.press('Escape');
      assert.equal(await spellInspector.isVisible(), false,
        'Escape closes only the spell inspector');
      assert.equal(await inspectSpell.evaluate((node) => node === document.activeElement), true,
        'Closing the inspection restores the Examinar button');
      assert.equal(await sheet.isVisible(), true);
      await grimoire.getByRole('button', { name: 'Ataque' }).click();
      assert.ok((await spellRows.count()) <= actualCount, 'Filtering cannot invent spellbook entries');
      await grimoire.getByRole('button', { name: 'Todos' }).click();
      assert.equal(await spellRows.count(), actualCount);
      await spellRows.first().focus();
      await page.keyboard.press('ArrowDown');
      const nextIndex = actualCount === 1 ? 0 : 1;
      assert.equal(await spellRows.nth(nextIndex).getAttribute('aria-pressed'), 'true',
        'ArrowDown moves spellbook selection without casting');
      assert.equal(await spellRows.nth(nextIndex).getAttribute('tabindex'), '0');
      assert.equal(await spellRows.nth(nextIndex).evaluate(
        (node) => document.activeElement === node), true,
        'Keyboard selection must move real focus, not just highlight');
      assert.equal(await spellRows.evaluateAll((nodes) =>
        nodes.filter((node) => node.tabIndex === 0).length), 1);
      await page.keyboard.press('Home');
      assert.equal(await spellRows.first().getAttribute('aria-pressed'), 'true',
        'Home selects the first known spell without casting');
      await spellRows.first().focus();
      await page.keyboard.press('Tab');
      assert.equal(await spellRows.evaluateAll((nodes) =>
        nodes.includes(document.activeElement)), false,
        'Tab must leave the grimoire instead of walking every spell');
      await grimoire.getByRole('button', { name: 'Todos' }).focus();
      assert.notEqual(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias',
        'The explicitly selected caster has her own spellbook, never spells for Matthias');
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true',
        'Switching hero should preserve the spellbook section');
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-spells-caster-' + width + '.png' });
      await sheet.getByRole('button', { name: 'Ver ficha de Matthias' }).click();
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias');
      await sheet.getByText('Este personaje no practica magia.').waitFor({ state: 'visible' });
      if (width === 1280) await page.screenshot({ path: 'smoke-character-sheet-spells-' + width + '.png' });

      // No Tactics-style talent tree in first-person MM3. Preserve scroll
      // restoration coverage on the actual Estado sheet instead: insert
      // inert duplicate stat rows only into this browser fixture, not game data.
      await nav.getByRole('button', { name: /Estado/ }).click();
      await assertNavigationHighlight(nav, 'Estado');
      assert.equal(await sheet.locator('[data-chronicles-training]').count(), 0);
      const scrollArea = sheet.locator('.chronicles-character-sheet__scroll');
      const ensureLongStatusFixture = async () => {
        const capacity = await scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
        if (capacity > 120 || width !== 1280) return capacity;
        await sheet.locator('[data-chronicles-chapter="record"] .chronicles-character-sheet__mm3-stats')
          .evaluate((grid) => {
            const rows = [...grid.querySelectorAll(':scope > [data-stat]:not([data-smoke-overflow])')];
            for (let batch = 0; batch < 12; batch += 1) {
              for (const row of rows) {
                const clone = row.cloneNode(true);
                clone.removeAttribute('data-stat');
                clone.setAttribute('aria-hidden', 'true');
                clone.dataset.smokeOverflow = 'true';
                grid.appendChild(clone);
              }
            }
          });
        return scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
      };
      const availableScroll = await ensureLongStatusFixture();
      if (availableScroll > 120) {
        exercisedScrollableDossier = true;
        await scrollArea.evaluate((node) => { node.scrollTop = Math.min(220, node.scrollHeight - node.clientHeight); });
        const before = await scrollArea.evaluate((node) => node.scrollTop);
        assert.ok(before > 60, 'The long Status fixture must actually scroll');
        await nav.getByRole('button', { name: /Equipo/ }).evaluate((node) => node.click());
        await page.waitForFunction(() => document.querySelector(
          '.chronicles-character-sheet__tabs button[aria-pressed="true"]'
        )?.textContent?.includes('Equipo'));
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) <= 2,
          'Changing to Equipment must restore the start of the dossier');
        await nav.getByRole('button', { name: /Estado/ }).click();
        await ensureLongStatusFixture();
        await scrollArea.evaluate((node) => {
          node.scrollTop = Math.min(220, node.scrollHeight - node.clientHeight);
        });
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) > 60,
          'Status must really be scrolled before switching the viewed hero');
        await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' })
          .evaluate((node) => node.click());
        await page.waitForFunction(() => document.querySelector(
          '#chronicles-character-sheet-title'
        )?.textContent === 'Hildegard');
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) <= 2,
          'A new hero must not inherit the previous hero desktop folio offset');
        assert.equal(await nav.getByRole('button', { name: /Estado/ }).getAttribute('aria-pressed'), 'true',
          'Switching heroes must preserve the chosen folio');
        await sheet.getByRole('button', { name: 'Ver ficha de Matthias' })
          .evaluate((node) => node.click());
        await page.waitForFunction(() => document.querySelector(
          '#chronicles-character-sheet-title'
        )?.textContent === 'Matthias');
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) <= 2);
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
  // MM3's explicit handoff on a real mounted React sheet + actual campaign
  // reducer: preview != selection, 1–4 always navigates, and contextual
  // controls transfer exactly one item without inventory multiplication.
  for (const [width, height] of [[1280,800],[390,844]]) {
    const ctx = await browser.newContext({
      viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500, deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url + '?interactive=1', { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      const heading = sheet.locator('#chronicles-character-sheet-title');
      const nav = sheet.getByRole('navigation', { name: 'Apartados de la ficha' });
      const dock = sheet.getByRole('navigation', { name: 'Seleccionar personaje de la compañía' });
      await sheet.waitFor({ state: 'visible' });
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard',
        'When no item is explicitly selected, 1–4 still navigate characters');
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      await nav.getByRole('button', { name: /Equipo/ }).click();
      const bag = sheet.locator('.chronicles-character-sheet__inventory');
      const sword = bag.locator('[data-inventory-item="bronze-sword"]');
      await sword.waitFor({ state: 'visible' });
      assert.equal(await sword.getAttribute('aria-pressed'), 'false',
        'A preview alone must not make 2 a transfer command');
      // The visual MM3 commands must behave like the row keyboard navigation:
      // start from the first/last real item, then wrap rather than getting stuck.
      const itemRows = bag.locator('[data-inventory-item]');
      assert.ok(await itemRows.count() > 1, 'Exercise wraparound with actual different items');
      const itemCommands = sheet.getByRole('navigation', { name: 'Acciones de inventario' });
      // Real reducer integration: first equip a loose sword, then select its
      // visible row in the SAME list and remove it. Stock returns exactly once.
      await sword.click();
      await itemCommands.getByRole('button', { name: /Equipar/ }).click();
      const firstWorn = bag.locator('[data-worn-slot="weapon"]');
      await firstWorn.waitFor({ state: 'visible' });
      assert.equal(await sword.count(), 0, 'Equipping one sword removes it from loose bag stock');
      assert.equal(await firstWorn.locator('[data-item-icon="sword"]').count(), 1,
        'The equipped sword has its own recognizable 16px icon');
      assert.equal(await firstWorn.getAttribute('aria-pressed'), 'false');
      await firstWorn.click();
      assert.equal(await firstWorn.getAttribute('aria-pressed'), 'true');
      assert.equal(await itemCommands.getByRole('button', { name: /Quitar/ }).isEnabled(), true);
      assert.equal(await sheet.locator('.chronicles-character-sheet__transfer-hint').isVisible(), true,
        'Worn selection must arm portrait/1–4 transfer like any bag item');
      assert.equal(await sheet.getByRole('navigation', { name: 'Seleccionar personaje de la compañía' })
        .getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).count(), 1,
      'Equipped gear offers direct handoff without needing Quitar first');
      await itemCommands.getByRole('button', { name: /Quitar/ }).click();
      assert.equal(await firstWorn.count(), 0, 'Unequip removes the worn object from the one list');
      await sword.waitFor({ state: 'visible' });
      assert.equal(await sword.count(), 1, 'Unequip restores one loose sword, without duplication');
      assert.equal(await sword.getAttribute('aria-pressed'), 'false');
      const allRows = bag.locator('[data-ledger-id]');
      assert.ok(await allRows.count() >= await itemRows.count(),
        'Worn and loose objects must share one numbered/list keyboard flow');
      if (width < 500) {
        // Up/Down are hidden from the touch toolbar, not removed from real
        // keyboard navigation. Mouse/touch can always tap a row directly.
        assert.equal(await itemCommands.getByRole('button', { name: /Abajo/ }).count(), 0);
        await allRows.first().focus();
        await page.keyboard.press('ArrowDown');
        assert.equal(await allRows.nth(1).getAttribute('aria-pressed'), 'true',
          'Touch layouts retain keyboard navigation between inventory rows');
        await page.keyboard.press('ArrowUp');
        assert.equal(await allRows.first().getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('ArrowUp');
        assert.equal(await allRows.last().getAttribute('aria-pressed'), 'true',
          'Keyboard Up wraps to last item without a visible arrow button');
        await page.keyboard.press('ArrowDown');
        assert.equal(await allRows.first().getAttribute('aria-pressed'), 'true');
      } else {
        const down = itemCommands.getByRole('button', { name: /Abajo/ });
        const up = itemCommands.getByRole('button', { name: /Arriba/ });
        await down.click();
        assert.equal(await allRows.first().getAttribute('aria-pressed'), 'true',
          'Down without selection starts at the first equipped or loose item');
        await up.click();
        assert.equal(await allRows.last().getAttribute('aria-pressed'), 'true',
          'Up from first wraps to last entry in the unified list');
        await down.click();
        assert.equal(await allRows.first().getAttribute('aria-pressed'), 'true',
          'Down from last wraps to first entry in the unified list');
      }
      // Numeric shortcuts are armed ONLY by a deliberate green item
      // selection. Pressing the same row a second time cancels that mode.
      if (await sword.getAttribute('aria-pressed') !== 'true') await sword.click();
      assert.equal(await sword.getAttribute('aria-pressed'), 'true');
      assert.equal(await sheet.locator('.chronicles-character-sheet__transfer-hint').isVisible(), true);
      assert.equal(await sheet.locator('.chronicles-character-sheet__classic-recipients').count(), 0);
      assert.equal(await itemCommands.getByRole('button', { name: /Entregar/ }).count(), 0);
      // This fixture is a genuine MM3-rules campaign, unlike the legacy
      // first-hour loot fixture. Inspect real read-only swap stats here.
      const swapDetails = sheet.locator('.chronicles-character-sheet__swap-preview');
      await sheet.getByRole('navigation', { name: 'Acciones de inventario' })
        .getByRole('button', { name: /Examinar/ }).click();
      await swapDetails.waitFor({ state: 'visible' });
      assert.equal(await swapDetails.getAttribute('open'), null,
        'MM3 weapon comparison must start folded');
      const swapSummary = swapDetails.locator('summary');
      assert.match(await swapSummary.innerText(), /Daño [+-]?\d+ · Acierto [+-]?\d+/,
        'Real damage and accuracy deltas must be visible before expanding');
      const closedSwapHeight = await swapDetails.evaluate((node) => node.getBoundingClientRect().height);
      assert.equal(await swapDetails.locator(':scope > div').first().isVisible(), false,
        'Closed details must not paint the hidden before/after stats');
      await swapSummary.click();
      assert.equal(await swapDetails.locator(':scope > div').count(), 2);
      assert.equal(await swapDetails.locator(':scope > div').first().isVisible(), true,
        'Expanding comparison reveals actual before/after rows');
      const expandedSwapHeight = await swapDetails.evaluate((node) => node.getBoundingClientRect().height);
      assert.ok(expandedSwapHeight >= closedSwapHeight + 30,
        'Folding the comparison must save visible height: '
        + JSON.stringify({ closedSwapHeight, expandedSwapHeight }));
      await swapSummary.click();
      assert.equal(await swapDetails.getAttribute('open'), null);
      assert.equal(await sheet.locator('.chronicles-character-sheet__inventory-hint').count(), 0,
        'The secondary bag hint must not add another scroll row beneath the list');
      const itemState = sheet.locator('.chronicles-character-sheet__item-details .chronicles-character-sheet__item-selection-state');
      assert.match(await itemState.innerText(), /Seleccionado · se puede entregar/,
        'Selection status stays next to the item and remains screen-reader announced');
      assert.equal(await sheet.locator('.chronicles-character-sheet__item-details').getAttribute('aria-live'), 'polite');
      await page.keyboard.press('Escape');
      assert.equal(await swapDetails.isVisible(), false,
        'Inspection must close without dismissing the parent or moving gear');
      assert.equal(await dock.getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).count(), 1);
      // 1 is the source's own slot: it must not transfer or navigate.
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      assert.equal(await sword.getAttribute('aria-pressed'), 'true',
        'Own party slot cannot be an item recipient');
      // Clicking the selected item disarms transfer and restores numeric
      // navigation without moving anything.
      await sword.click();
      assert.equal(await sword.getAttribute('aria-pressed'), 'false');
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard', '2 navigates when item is deselected');
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      await sword.waitFor({ state: 'visible' });
      assert.equal(await sword.getAttribute('aria-pressed'), 'false',
        'Changing heroes clears item selection');
      await sword.click();
      assert.equal(await sword.getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Matthias',
        'Direct transfer does not navigate away from the source hero');
      assert.equal(await sword.count(), 0, 'Exactly one sword leaves Matthias bag');
      assert.equal(await sheet.locator('.chronicles-character-sheet__transfer-hint').count(), 0,
        'Successful transfer disarms numeric delivery');
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard', '2 navigates after transfer');
      const recipientBag = sheet.locator('.chronicles-character-sheet__inventory');
      const receivedSword = recipientBag.locator('[data-inventory-item="bronze-sword"]');
      await receivedSword.waitFor({ state: 'visible' });
      assert.equal(await receivedSword.count(), 1, 'Sword arrives intact in Hildegard bag');
      await receivedSword.click();
      assert.equal(await dock.getByRole('button', { name: /Entregar 1 .* a Matthias/ }).count(), 1,
        'Portraits are accessible touch destinations when the item is selected');
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Hildegard', 'Returning by 1 retains source dossier');
      assert.equal(await receivedSword.count(), 0, 'Hildegard no longer owns the sword');
      await dock.getByRole('button', { name: /Ver ficha de Matthias/ }).click();
      assert.equal(await heading.innerText(), 'Matthias', 'Portraits navigate without selected item');
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 1,
        'The same sword returns without duplication');
      // Touch/mouse shortcut: tapping another hero portrait directly delivers.
      await bag.locator('[data-inventory-item="bronze-sword"]').click();
      await dock.getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).click();
      assert.equal(await heading.innerText(), 'Matthias');
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 0);
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard');
      await recipientBag.locator('[data-inventory-item="bronze-sword"]').click();
      await page.keyboard.press('1');
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 1);
      // No searchbox: pressing the source's own number must not deliver
      // the selected item, but selecting another party slot does.
      await bag.locator('[data-inventory-item="bronze-sword"]').click();
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias',
        'Pressing the source slot while an item is selected keeps the current owner');
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 1);
      await bag.locator('[data-inventory-item="bronze-sword"]').click();
      assert.equal(await sheet.locator('.chronicles-character-sheet__transfer-hint').count(), 0,
        'Clicking a selected item a second time disarms direct delivery');
      assert.equal(await sheet.locator('.chronicles-character-sheet__backpack-tools').count(), 0);
      assert.deepEqual(errors, [], 'No React or handler errors during item transfers');
      await page.screenshot({ path: `smoke-mm3-manual-handoff-${width}.png` });
      console.log(`MM3_MANUAL_HANDOFF_OK ${width}x${height}`);
    } catch (error) {
      failures.push(`handoff ${width}: ${error.message}`);
      console.error('MM3_MANUAL_HANDOFF_FAIL', width, error);
    } finally {
      await ctx.close();
    }
  }

  // Regression: a selected WORN item in the single MM3 list must transfer
  // directly via portrait OR numeric hotkey, not navigate to the recipient.
  // Use the actual campaign reducer and inspect both owners' inventory.
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const ctx = await browser.newContext({
      viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url + '?interactive=1', { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      const heading = sheet.locator('#chronicles-character-sheet-title');
      await sheet.getByRole('navigation', { name: 'Apartados de la ficha' })
        .getByRole('button', { name: /Equipo/ }).click();
      const bag = sheet.locator('.chronicles-character-sheet__inventory');
      const actions = sheet.getByRole('navigation', { name: 'Acciones de inventario' });
      const dock = sheet.getByRole('navigation', { name: 'Seleccionar personaje de la compañía' });
      const sword = bag.locator('[data-inventory-item="bronze-sword"]');
      await sword.click();
      await actions.getByRole('button', { name: /Equipar/ }).click();
      const worn = bag.locator('[data-worn-slot="weapon"]');
      await worn.waitFor({ state: 'visible' });
      await worn.click();
      assert.equal(await worn.getAttribute('aria-pressed'), 'true');
      assert.equal(await dock.getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).count(), 1);
      await dock.getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).click();
      assert.equal(await heading.innerText(), 'Matthias',
        'Giving equipped sword from portrait must NOT switch the open hero');
      assert.equal(await worn.count(), 0, 'Given sword leaves the equipped weapon slot');
      assert.equal(await sword.count(), 0, 'Given sword is not duplicated in source bag');
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard');
      await sword.waitFor({ state: 'visible' });
      assert.equal(await sword.count(), 1, 'Recipient carries the same sword in bag, not auto-equipped');
      await sword.click();
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Hildegard',
        'Recipient can return the sword directly with the numeric shortcut');
      assert.equal(await sword.count(), 0);
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      await sword.waitFor({ state: 'visible' });
      await sword.click();
      await actions.getByRole('button', { name: /Equipar/ }).click();
      await worn.waitFor({ state: 'visible' });
      await worn.click();
      assert.equal(await dock.getByRole('button', { name: /Entregar 1 .* a Aziz/ }).count(), 1);
      await page.keyboard.press('3');
      assert.equal(await heading.innerText(), 'Matthias',
        'Numeric 3 transfers the worn sword and preserves the source dossier');
      assert.equal(await worn.count(), 0);
      await page.keyboard.press('3');
      assert.equal(await heading.innerText(), 'Aziz');
      await sword.waitFor({ state: 'visible' });
      assert.equal(await sword.count(), 1, 'Numeric recipient obtains exactly one item');
      assert.deepEqual(errors, [], 'No browser exceptions while transferring equipped weapons');
      console.log(`MM3_WORN_HANDOFF_OK ${width}x${height}`);
    } catch (error) {
      failures.push(`worn handoff ${width}: ${error.message}`);
      console.error('MM3_WORN_HANDOFF_FAIL', width, error);
    } finally {
      await ctx.close();
    }
  }

  // Transfers must be blocked during combat, even after explicit selection.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(url + '?interactive=1&combat=1', { waitUntil: 'networkidle' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      await sheet.getByRole('navigation', { name: 'Apartados de la ficha' })
        .getByRole('button', { name: /Equipo/ }).click();
      const sword = sheet.locator('[data-inventory-item="bronze-sword"]');
      await sword.click();
      assert.equal(await sheet.locator('.chronicles-character-sheet__transfer-hint').count(), 0,
        'Combat must not arm direct transfer despite a selected row');
      assert.equal(await sheet.locator('.chronicles-character-sheet__classic-recipients').count(), 0,
        'No recipient picker exists in direct-transfer UX');
      await page.keyboard.press('2');
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Hildegard',
        'Browsing Hildegard is allowed even when transfer is blocked');
      await page.keyboard.press('1');
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias');
      assert.equal(await sword.count(), 1, 'Browsing in combat must not move the sword');
      console.log('MM3_EXPLICIT_HANDOFF_COMBAT_GUARD_OK');
    } catch (error) {
      failures.push('handoff combat guard: ' + error.message);
    } finally {
      await ctx.close();
    }
  }

  // Exercise the production sheet on touch devices too. The compact identity
  // is only successful if the party dock, tabs and equipment remain usable.
  for (const [width, height] of [[360,780],[390,844],[430,932],[844,390]]) {
    const ctx = await browser.newContext({
      viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'load' });
      const sheet = page.locator('[data-chronicles-folio="v2"]');
      await sheet.waitFor({ state: 'visible' });
      await assertReadableMM3Level(sheet, width + 'x' + height);
      const geometry = await sheet.evaluate((node) => {
        const head = node.querySelector('.chronicles-character-sheet__head').getBoundingClientRect();
        const dock = node.querySelector('.chronicles-character-sheet__party-dock').getBoundingClientRect();
        return {
          headerHeight: head.height,
          headColumns: getComputedStyle(node.querySelector('.chronicles-character-sheet__head'))
            .gridTemplateColumns.split(' ').filter(Boolean).length,
          dockBottom: dock.bottom,
          dialogBottom: node.getBoundingClientRect().bottom,
          docWidth: document.documentElement.scrollWidth,
          portraitCount: node.querySelectorAll('.chronicles-character-sheet__head img').length,
          dockPortraits: node.querySelectorAll('.chronicles-character-sheet__party-dock img').length,
          dockPortraitsVisible: [...node.querySelectorAll('.chronicles-character-sheet__party-dock img')]
            .filter((img) => getComputedStyle(img).display !== 'none').length,
          dockHeight: dock.height,
          dockButtons: [...node.querySelectorAll('.chronicles-character-sheet__party-dock button')].map((button) => {
            const name = button.querySelector('.chronicles-character-sheet__party-name');
            const hp = button.querySelector('.chronicles-character-sheet__party-hp');
            const value = hp.querySelector('.chronicles-character-sheet__party-hp-value');
            const unit = hp.querySelector('.chronicles-character-sheet__party-hp-unit');
            return {
              height: button.getBoundingClientRect().height,
              name: name.textContent.trim(),
              nameClipped: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1,
              nameWhiteSpace: getComputedStyle(name).whiteSpace,
              hpVisible: getComputedStyle(hp).display !== 'none',
              hpClipped: hp.scrollWidth > hp.clientWidth + 1,
              hpWidth: hp.clientWidth,
              hpScrollWidth: hp.scrollWidth,
              fraction: value.textContent.trim(),
              healthGlyph: getComputedStyle(value, '::before').content,
              unitVisible: getComputedStyle(unit).display !== 'none',
              accessibleLabel: button.getAttribute('aria-label'),
            };
          }),
        };
      });
      assert(geometry.headerHeight <= (height <= 480 ? 85 : 100),
        'Compact touch identity must leave room for content: ' + JSON.stringify(geometry));
      if (height <= 480) assert.equal(geometry.headColumns, 2,
        'Short landscape has no portrait: reserve only identity and close columns');
      assert.equal(geometry.portraitCount, 0);
      assert.equal(geometry.dockPortraits, 4, 'Four portraits stay available for the desktop selector');
      assert.equal(geometry.dockPortraitsVisible, 0,
        'Touch selector must hide portraits without losing hero buttons');
      assert.ok(geometry.dockHeight >= 44 && geometry.dockHeight <= 68,
        'Compact party navigation must preserve vertical space: ' + JSON.stringify(geometry));
      assert.equal(geometry.dockButtons.length, 4, 'All heroes must remain selectable on touch');
      assert.ok(geometry.dockButtons.every(({ height: hitHeight, hpVisible }) => hitHeight >= 44 && hpVisible),
        'Live HP and touch targets must remain visible: ' + JSON.stringify(geometry));
      assert.deepEqual(geometry.dockButtons.filter(({ hpClipped }) => hpClipped), [],
        'Every live HP fraction must fit the actual painted party dock: ' + JSON.stringify(geometry.dockButtons));
      if (width <= 620) {
        assert.ok(geometry.dockButtons.every(({ nameWhiteSpace }) => nameWhiteSpace === 'nowrap'),
          'Phone hero names must fit on one full-width row without ellipses: ' + JSON.stringify(geometry.dockButtons));
        assert.deepEqual(geometry.dockButtons.filter(({ nameClipped }) => nameClipped), [],
          'All four hero names must be fully readable in the painted dock: ' + JSON.stringify(geometry.dockButtons));
      }
      assert.ok(geometry.dockButtons.every(({ fraction, accessibleLabel }) => {
        const [current, maximum] = fraction.split('/');
        return /^\d+\/\d+$/.test(fraction) && accessibleLabel.includes(`${current} de ${maximum} PV`);
      }), 'Compact visual HP must retain the complete accessible fraction and unit: ' + JSON.stringify(geometry.dockButtons));
      assert.ok(geometry.dockButtons.every(({ unitVisible }) => unitVisible === (width > 380)),
        'Only the narrowest phone may omit the redundant visible PV suffix: ' + JSON.stringify(geometry.dockButtons));
      assert.ok(geometry.dockButtons.every(({ healthGlyph }) =>
        (healthGlyph.includes('♥')) === (width <= 380)),
      'Only narrow phones should show a health glyph when the PV suffix is hidden: ' + JSON.stringify(geometry.dockButtons));
      assert(geometry.docWidth <= width + 1, 'No horizontal document overflow: ' + JSON.stringify(geometry));
      assert(geometry.dockBottom <= geometry.dialogBottom + 2,
        'Party selector must stay inside the dialog: ' + JSON.stringify(geometry));
      const nav = sheet.getByRole('navigation', { name: 'Apartados de la ficha' });
      const equipmentTab = nav.getByRole('button', { name: /Equipo/ });
      // Reproduce the original bug: a long Estado scroll carried into the
      // Equipment tab. Use native click to avoid Playwright's auto-scroll
      // masking the mistake.
      await sheet.locator('.chronicles-character-sheet__scroll')
        .evaluate((scroll) => { scroll.scrollTop = scroll.scrollHeight; });
      await equipmentTab.evaluate((button) => button.click());
      await sheet.locator('[data-chronicles-equipment-folio] [data-inventory-item]').first()
        .waitFor({ state: 'visible' });
      const fold = await sheet.evaluate((node) => {
        const scroll = node.querySelector('.chronicles-character-sheet__scroll');
        const dock = node.querySelector('.chronicles-character-sheet__party-dock');
        const first = node.querySelector('[data-chronicles-equipment-folio] [data-ledger-id]');
        const title = node.querySelector('[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head');
        const name = node.querySelector('.chronicles-character-sheet__identity h3');
        const tabs = node.querySelector('.chronicles-character-sheet__tabs');
        const headBox = name.getBoundingClientRect();
        const scrollBox = scroll.getBoundingClientRect();
        const rowBox = first.getBoundingClientRect();
        return {
          scrollTop: scroll.scrollTop,
          rowTop: rowBox.top, rowBottom: rowBox.bottom, rowLeft: rowBox.left,
          dockTop: dock.getBoundingClientRect().top,
          scrollTopEdge: scrollBox.top,
          tabHeight: tabs.getBoundingClientRect().height,
          titleHidden: getComputedStyle(title).display === 'none',
          nameTop: headBox.top, nameLeft: headBox.left, scrollLeftEdge: scrollBox.left,
        };
      });
      assert.ok(fold.scrollTop <= 2 && fold.nameTop >= fold.scrollTopEdge - 2,
        'Switching to Equipo must reveal the real hero identity, not preserve the old scroll: '
          + JSON.stringify(fold));
      assert.ok(fold.titleHidden && fold.tabHeight <= 55,
        'One compact tab row and no duplicate item heading on mobile: ' + JSON.stringify(fold));
      assert.ok(fold.rowTop >= fold.scrollTopEdge && fold.rowBottom <= fold.dockTop - 2,
        'The first inventory item must be fully visible on the first fold, ABOVE the fixed party dock: '
          + JSON.stringify(fold));
      assert.ok(fold.rowLeft >= fold.scrollLeftEdge - 2 && fold.nameLeft >= fold.scrollLeftEdge - 2,
        'Equipment rows and identity cannot be cropped by the left frame: ' + JSON.stringify(fold));
      assert.equal(await sheet.locator('.chronicles-character-sheet__backpack-tools').count(), 0,
        'Filtrar y buscar must not consume equipment space on Android');
      const mobileLayout = await sheet.evaluate((node) => {
        const inventory = node.querySelector('[data-chronicles-equipment-folio] .chronicles-character-sheet__inventory');
        const commands = [...node.querySelectorAll('[data-chronicles-equipment-folio] .chronicles-character-sheet__classic-actions > button')];
        const rows = [...inventory.querySelectorAll('[data-ledger-id]')];
        return {
          totalRows: rows.length,
          rows: rows.map((row) => {
            const rect = row.getBoundingClientRect();
            const name = row.querySelector('span')?.getBoundingClientRect();
            const icon = row.querySelector('.chronicles-character-sheet__inventory-glyph')?.getBoundingClientRect();
            return { height: rect.height, iconRight: icon?.right, nameLeft: name?.left,
              overflow: row.scrollWidth > row.clientWidth + 2 };
          }),
          commands: commands.map((button) => ({
            visible: getComputedStyle(button).display !== 'none',
            height: button.getBoundingClientRect().height,
          })),
        };
      });
      assert.ok(mobileLayout.totalRows >= 3, 'All real items must remain in the unfiltered inventory');
      assert.ok(mobileLayout.rows.every((r) => r.height >= 44 && r.height <= 54
        && r.nameLeft >= r.iconRight + 2 && !r.overflow),
        'Mobile inventory must read as one compact icon/name row per item: ' + JSON.stringify(mobileLayout));
      assert.deepEqual(mobileLayout.commands.map(({ visible }) => visible),
        [false, false, true, true, false],
        'Touch shows only Equipar/Quitar and Examinar; desktop keeps five commands');
      assert.ok(mobileLayout.commands.filter(({ visible }) => visible)
        .every(({ height: hitHeight }) => hitHeight >= 44),
        'All visible commands remain usable 44px touch targets');
      // Photograph a genuinely populated hero backpack before switching to
      // the empty Hildegard fixture. This is the mobile inventory golden path.
      if (width <= 430) {
        const backpackRows = sheet.locator('[data-chronicles-equipment-folio] [data-inventory-item]');
        assert.ok(await backpackRows.count() >= 3,
          'The mobile backpack evidence must show real populated inventory');
        const glyphGeometry = await backpackRows.evaluateAll((buttons) => buttons.map((button) => {
          const icon = button.querySelector('.chronicles-character-sheet__inventory-glyph');
          const name = button.querySelector('span');
          const iconBox = icon.getBoundingClientRect();
          const nameBox = name.getBoundingClientRect();
          return {
            display: getComputedStyle(button).display,
            iconWidth: iconBox.width, iconHeight: iconBox.height,
            iconRight: iconBox.right, nameLeft: nameBox.left,
            rowHeight: button.getBoundingClientRect().height,
            clipped: button.scrollWidth > button.clientWidth + 1,
          };
        }));
        assert.ok(glyphGeometry.every((row) => row.display === 'grid'
          && row.iconWidth >= 24 && row.iconHeight >= 24
          && row.nameLeft >= row.iconRight + 5
          && row.rowHeight >= 44 && row.rowHeight <= 52 && !row.clipped),
        'Populated mobile inventory must align legible category icons and names without taller rows: '
          + JSON.stringify(glyphGeometry));
        // The fixed hero dock must show a continuation cue only while the
        // genuinely scrollable equipment dossier still has content below.
        const scrollArea = sheet.locator('.chronicles-character-sheet__scroll');
        const dock = sheet.locator('.chronicles-character-sheet__party-dock');
        const scrollCapacity = await scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
        if (scrollCapacity > 12) {
          // Only require the continuation cue when the dossier really overflows.
          // A compact, fully visible inventory is strictly better than forced scroll.
        await page.waitForFunction(() => document.querySelector(
          '.chronicles-character-sheet__scroll'
        )?.dataset.moreBelow === 'true');
        const cueAtTop = await dock.evaluate((node) => getComputedStyle(node, '::before').content);
        assert.match(cueAtTop, /↓ Más/,
          'Mobile dock must signal more content without hiding its party buttons');
        const cueGeometry = await dock.evaluate((node) => {
          const cue = getComputedStyle(node, '::before');
          return { top: cue.top, height: parseFloat(cue.height),
            dockHeight: node.getBoundingClientRect().height };
        });
        assert.equal(cueGeometry.top, '0px',
          'Continuation cue must stay inside the dock instead of covering statistics');
        assert.ok(cueGeometry.height <= 18 && cueGeometry.dockHeight <= 68,
          'Cue must not enlarge or obscure the persistent hero dock: ' + JSON.stringify(cueGeometry));
        await scrollArea.evaluate((node) => { node.scrollTop = node.scrollHeight; });
        await page.waitForFunction(() => document.querySelector(
          '.chronicles-character-sheet__scroll'
        )?.dataset.moreBelow === 'false');
        const cueAtEnd = await dock.evaluate((node) => getComputedStyle(node, '::before').content);
        assert.ok(cueAtEnd === 'none' || cueAtEnd === 'normal',
          'Continuation cue must disappear at the real end of the dossier: ' + cueAtEnd);
        if (width === 390) await page.screenshot({ path: 'smoke-character-sheet-scroll-end-390.png' });
        await scrollArea.evaluate((node) => { node.scrollTop = 0; });
        await page.waitForFunction(() => document.querySelector(
          '.chronicles-character-sheet__scroll'
        )?.dataset.moreBelow === 'true');
        await page.mouse.move(10, 10);
        } else {
          assert.equal(await scrollArea.evaluate((node) => node.dataset.moreBelow), 'false',
            'A fully visible inventory must not advertise imaginary content below');
          assert.equal(await sheet.getByRole('navigation', { name: 'Acciones de inventario' })
            .locator('button').count(), 5, 'Compact phones retain five commands; delivery uses party slots');
        }
        await page.screenshot({ path: 'smoke-character-sheet-backpack-' + width + '.png' });
      }
      assert(await equipmentTab.evaluate((node) => node.getBoundingClientRect().height)
        >= (height <= 480 ? 34 : 44), 'Touch equipment tab must remain usable');
      await nav.getByRole('button', { name: /Hechizos/ }).click();
      if (width === 390) {
        // Capture the actual populated mobile spell catalogue and its floating
        // inspection, not an empty spellbook from a non-caster.
        await sheet.getByRole('button', { name: 'Ver ficha de Aziz' }).click();
        const mobileGrimoire = sheet.locator('[data-chronicles-grimoire]');
        await mobileGrimoire.waitFor({ state: 'visible' });
        assert.ok(await mobileGrimoire.locator('[data-grimoire-spell]').count() >= 1,
          'Mobile spellbook evidence must show a caster with learned spells');
        await page.screenshot({ path: 'smoke-character-sheet-spells-390.png' });
        await mobileGrimoire.getByRole('button', { name: /Examinar/ }).click();
        const mobileInspector = mobileGrimoire.getByRole('dialog');
        assert.equal(await mobileInspector.isVisible(), true);
        const mobilePopup = await mobileInspector.boundingBox();
        assert.ok(mobilePopup && mobilePopup.x >= 0
          && mobilePopup.x + mobilePopup.width <= width + 1,
          'Mobile spell inspector must remain inside the viewport');
        await page.screenshot({ path: 'smoke-character-sheet-spell-inspect-390.png' });
        await mobileInspector.getByRole('button', { name: 'Cerrar inspección de hechizo' }).click();
      }
      await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true',
        'Changing party member must retain chosen folio on touch devices');
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert(await sheet.locator('[data-chronicles-equipment-folio]').isVisible());
      const equipmentSubtitle = sheet.locator(
        '[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head > div > small'
      );
      assert.match(await equipmentSubtitle.textContent(), /Mochila personal/);
      assert.equal(await equipmentSubtitle.isVisible(), false,
        'The mobile Equipment subtitle is redundant on phones and short landscape alike');
      const companyGoldChip = sheet.locator('.chronicles-character-sheet__quick [data-resource="gold"]');
      const repeatedEquipmentGold = sheet.locator(
        '[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head > b'
      );
      assert.equal(await companyGoldChip.isVisible(), true,
        'The primary company gold balance must remain visible in the identity strip');
      assert.equal(await repeatedEquipmentGold.count(), 0,
        'MM3 already shows company gold in the identity strip; do not repeat it in Equipment');
      if (width <= 520) {
        const controls = sheet.getByRole('navigation', { name: 'Acciones de inventario' });
        assert.equal(await controls.getByRole('button', { name: 'Detalles', exact: true }).count(), 0);
        assert.equal(await controls.getByRole('button', { name: 'Examinar', exact: true }).count(), 1,
          'Touch must have exactly one meaningful inspect action');
        assert.equal(await sheet.locator('#chronicles-equipment-technical-details').count(), 0);
      }
      // Hildegard's longer name exposed a real 844x390 overlap with the close
      // button. Check actual painted rectangles, not only document overflow.
      const identity = await sheet.evaluate((node) => {
        const head = node.querySelector('.chronicles-character-sheet__head');
        const wrapper = head.querySelector('.chronicles-character-sheet__identity');
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        };
        const title = wrapper.querySelector('h3');
        const description = wrapper.querySelector('p');
        const resources = wrapper.querySelector('.chronicles-character-sheet__quick');
        return {
          head: rect(head), wrapper: rect(wrapper), title: rect(title),
          description: rect(description), resources: rect(resources),
          close: rect(head.querySelector('button')),
          overflow: wrapper.scrollWidth - wrapper.clientWidth,
          titleText: title.textContent.trim(),
          classText: description.textContent.trim(),
          descriptionVisible: getComputedStyle(description).display !== 'none',
          columns: getComputedStyle(wrapper).gridTemplateColumns,
        };
      });
      // Computed ink contrast, not a CSS-string assertion: the 390px
      // screenshot exposed pale PV/PH/ORO labels and values on beige chips.
      for (const resource of ['health', 'magic', 'gold']) {
        await assertResourceContrast(sheet, resource);
      }
      assert.equal(identity.titleText, 'Hildegard', 'Fixture must check the longer hero name');
      assert.match(identity.classText, /Nivel/, 'Class and level must remain readable');
      assert.ok(identity.overflow <= 1,
        'Identity must not overflow its reserved column: ' + JSON.stringify(identity));
      for (const key of ['title', 'description', 'resources']) {
        assert.ok(identity[key].right <= identity.close.left - 3,
          key + ' must not collide with close button: ' + JSON.stringify(identity));
        assert.ok(identity[key].bottom <= identity.head.bottom + 1,
          key + ' must remain inside the header: ' + JSON.stringify(identity));
      }
      if (height <= 480) {
        assert.equal(identity.descriptionVisible, false,
          'In short-landscape Equipo, redundant class/level text must free space for the inventory');
        assert.ok(identity.resources.top >= identity.title.bottom - 1,
          'Landscape gold/resources must sit below the hero name without overlap: '
            + JSON.stringify(identity));
      }
      await page.screenshot({ path: 'smoke-character-sheet-compact-' + width + '.png' });
      assert.deepEqual(errors, []);
      console.log('CHRONICLES_CHARACTER_COMPACT_MOBILE_OK ' + width + 'x' + height);
    } catch (error) {
      failures.push(width + ': ' + error.message);
      console.error('CHRONICLES_CHARACTER_COMPACT_MOBILE_FAIL', width, error);
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
if (failures.length) throw new Error(failures.join('\n'));
assert.ok(exercisedScrollableDossier, 'At least one desktop fixture must exercise long-page scroll restoration');