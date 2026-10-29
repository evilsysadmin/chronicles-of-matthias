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
  for (const [width, height] of [[1024,768],[1280,800],[1440,900],[1760,870]]) {
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
      assert(metrics.headerHeight <= 82, 'MM3 identity must be a compact strip, not a portrait cover: ' + metrics.headerHeight + 'px');
      assert.equal(await sheet.locator('.chronicles-character-sheet__head .chronicles-character-sheet__portrait').count(), 0,
        'Do not duplicate the permanent party-dock portrait');
      const xpHeight = await sheet.locator('.chronicles-character-sheet__progression')
        .evaluate((node) => node.getBoundingClientRect().height);
      assert(xpHeight <= 36, 'XP cannot steal workbench height: ' + xpHeight);
      const partyDock = sheet.getByRole('navigation', { name: 'Seleccionar personaje de la compañía' });
      assert.equal(await partyDock.locator('img').count(), 0,
        'The equipment dossier must not repeat the large exploration portraits');
      assert.equal(await partyDock.locator('button').count(), 4,
        'All four characters must remain directly selectable');
      const partyDockHeight = await partyDock.evaluate((node) => node.getBoundingClientRect().height);
      assert.ok(partyDockHeight >= 44 && partyDockHeight <= 68,
        'Compact hero selection should give height back to the equipment workbench: ' + partyDockHeight);
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
          const gear = content.querySelector('.chronicles-character-sheet__worn');
          const statGrid = content.querySelector('.chronicles-character-sheet__mm3-stats');
          const gearGrid = gear.querySelector('ul');
          const columns = (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
          const labels = [...statGrid.querySelectorAll('[data-stat]')].map((el) => ({
            name: el.dataset.stat, clipped: el.scrollWidth > el.clientWidth + 2,
          }));
          const rect = (el) => {
            const box = el.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, width: box.width };
          };
          return { content: rect(content), stats: rect(stats), battle: rect(battle),
            gear: rect(gear), statColumns: columns(statGrid),
            gearColumns: columns(gearGrid), labels };
        });
        assert.equal(ledger.statColumns, 4,
          'Classic MM3 status must be a full-width four-column ledger: ' + JSON.stringify(ledger));
        assert.equal(ledger.gearColumns, 4,
          'Worn gear should be a four-slot horizontal quick reference: ' + JSON.stringify(ledger));
        assert.equal(ledger.labels.length, 8,
          'All seven MM3 attributes plus the real HP condition must be present');
        assert.deepEqual(ledger.labels.filter((item) => item.clipped), [],
          'The new attribute cells must not overflow: ' + JSON.stringify(ledger));
        assert.ok(ledger.stats.width >= ledger.content.width - 40
          && ledger.stats.bottom <= ledger.battle.top + 2
          && ledger.battle.bottom <= ledger.gear.top + 2,
          'The attribute ledger must be ABOVE the combat and equipment strips: '
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
      assert.equal(await sheet.getByText('Mochila de Matthias').count(), 1,
        'Each MM3 equipment dossier must identify the selected hero own backpack');
      const meleeCard = sheet.locator('.chronicles-character-sheet__weapon-card').first();
      await meleeCard.waitFor({ state: 'visible' });
      await assertParchmentSurface(meleeCard, 'Equipment weapon card');
      // Weapons A/S appear exactly once: no repeated gear slots below.
      // Their real unequip controls live inside the matching weapon cards.
      const weaponCards = sheet.locator('.chronicles-character-sheet__weapon-card');
      assert.equal(await weaponCards.count(), 2);
      assert.deepEqual(await sheet.locator(
        '.chronicles-character-sheet__equipment .chronicles-character-sheet__gear-slot > small'
      ).allInnerTexts(), ['Armadura', 'Escudo'],
      'MM3 keeps only armour and shield as separate slots');
      for (const slot of ['weapon', 'missile']) {
        const card = sheet.locator('.chronicles-character-sheet__weapon-card[data-slot="' + slot + '"]');
        const hasItem = (await card.locator('strong').innerText()) !== 'Sin equipar';
        assert.equal(await card.getByRole('button', { name: /Quitar .* y guardarlo en la mochila/ }).count(),
          hasItem ? 1 : 0,
          'An equipped ' + slot + ' must have one and only one real unequip action');
      }
      // Empty relics must not waste half the equipment dossier width.
      const emptyRelicLayout = await sheet.locator('.chronicles-character-sheet__loadout.is-relic-empty')
        .evaluate((node) => {
          const relicCard = node.querySelector(':scope > .chronicles-character-sheet__relic').getBoundingClientRect();
          const equipmentCard = node.querySelector(':scope > .chronicles-character-sheet__equipment').getBoundingClientRect();
          const packNode = node.querySelector(':scope > .chronicles-character-sheet__backpack');
          const backpack = packNode.getBoundingClientRect();
          const columns = getComputedStyle(node).gridTemplateColumns;
          const packGridArea = getComputedStyle(packNode).gridArea;
          return { columns, packGridArea, relicHeight: relicCard.height, relicWidth: relicCard.width,
            equipmentWidth: equipmentCard.width, relicBottom: relicCard.bottom,
            equipmentTop: equipmentCard.top, equipmentBottom: equipmentCard.bottom, equipmentLeft: equipmentCard.left, relicTop: relicCard.top,
            backpackLeft: backpack.left, backpackRight: backpack.right,
            backpackTop: backpack.top, backpackBottom: backpack.bottom, backpackWidth: backpack.width };
        });
      // The MM3 inventory is now the FIRST readable/actionable chapter,
      // above the secondary equipped-gear summary and the compact relic.
      const firstEquipmentArticle = await sheet.locator(
        '[data-chronicles-equipment-folio] .chronicles-character-sheet__loadout > article'
      ).first().getAttribute('class');
      assert.ok(firstEquipmentArticle.includes('chronicles-character-sheet__backpack'),
        'Equipment should open on the playable inventory rather than the empty relic');
      assert.ok(emptyRelicLayout.relicHeight <= 85,
        'A missing relic should occupy a compact row: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(emptyRelicLayout.equipmentTop >= emptyRelicLayout.backpackBottom - 2,
        'Equipped gear must follow the primary backpack, never overlap it: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(emptyRelicLayout.relicTop >= emptyRelicLayout.equipmentBottom - 2,
        'The secondary relic note must follow the worn gear summary: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(emptyRelicLayout.backpackWidth >= 230 && emptyRelicLayout.equipmentWidth >= 290,
        'Both inventory and equipped gear must remain readable: ' + JSON.stringify(emptyRelicLayout));
      assert.ok(Math.abs(emptyRelicLayout.backpackLeft - emptyRelicLayout.equipmentLeft) <= 2
        && Math.abs(emptyRelicLayout.backpackWidth - emptyRelicLayout.equipmentWidth) <= 4,
        'Inventory and worn gear must share one clear full-width reading column: '
        + JSON.stringify(emptyRelicLayout));
      await page.screenshot({ path: 'smoke-character-sheet-equipment-' + width + '.png' });

      // MM3 inventory desk with real catalog items from the campaign reducer.
      const equipment = sheet.locator('[data-chronicles-equipment-folio]');
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
      const detail = equipment.locator('.chronicles-character-sheet__item-details');
      assert.equal(await detail.isVisible(), true, 'Item detail appears without a preliminary click');
      // Optional mechanics are initially closed, making the decision and
      // Equipar action available without a wall of catalogue rows.
      const more = detail.locator('.chronicles-character-sheet__item-more');
      assert.equal(await more.evaluate((node) => node.open), false,
        'Long object attributes must start collapsed');
      assert.equal(await more.locator('dl').isVisible(), false);
      const initialDetail = await detail.evaluate((node) => {
        const essentials = node.querySelector(':scope > .chronicles-character-sheet__item-essentials');
        const action = node.querySelector(':scope > button');
        const optional = node.querySelector(':scope > .chronicles-character-sheet__item-more');
        const preview = node.querySelector(':scope > .chronicles-character-sheet__swap-preview');
        const dock = document.querySelector('.chronicles-character-sheet__party-dock');
        return { essentials: essentials?.getBoundingClientRect().top,
          action: action?.getBoundingClientRect().bottom,
          optional: optional?.getBoundingClientRect().top,
          preview: preview?.getBoundingClientRect().top,
          dock: dock?.getBoundingClientRect().top };
      });
      assert.ok(initialDetail.essentials < initialDetail.optional,
        'Core item identity and class compatibility precede the optional record');
      assert.ok(initialDetail.action < initialDetail.optional,
        'Equipar must precede the expanded long item description');
      if (initialDetail.preview != null) {
        assert.ok(initialDetail.preview < initialDetail.action,
          'Read-only before/after mechanics must precede Equipar');
      }
      if (width >= 1200) {
        assert.ok(initialDetail.action < initialDetail.dock - 6,
          'Primary equip action must be visible above the party dock: ' + JSON.stringify(initialDetail));
      }
      await more.locator('summary').click();
      if (width >= 1200) {
        const ledger = await more.locator('dl').evaluate((node) => ({
          columns: getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length,
          entries: node.querySelectorAll(':scope > div').length,
          labels: [...node.querySelectorAll('dt')].map((element) => element.textContent.trim()),
          overflow: node.scrollWidth > node.clientWidth + 1,
        }));
        assert.equal(ledger.columns, 2, 'Expanded mechanics must use two compact columns');
        assert.ok(ledger.entries >= 6 && ledger.labels.includes('Puede usarlo'),
          'Detailed object stats and equipability remain available on demand');
        assert.equal(ledger.overflow, false, 'Expanded stats cannot scroll sideways');
      }
      await more.locator('summary').click();
      assert.equal(await more.evaluate((node) => node.open), false);

      // Opening Equipment must show the inventory list immediately. On wide
      // desktop the selected item's details take priority over optional filters;
      // narrow desktop retains its existing filter-first arrangement.
      const aboveFold = await equipment.evaluate((node) => {
        const rect = (selector) => node.querySelector(selector).getBoundingClientRect();
        const list = rect('.chronicles-character-sheet__inventory');
        const firstItem = rect('[data-inventory-item]');
        const tools = rect('.chronicles-character-sheet__backpack-tools');
        const inspector = rect('.chronicles-character-sheet__item-details');
        const dock = document.querySelector('.chronicles-character-sheet__party-dock').getBoundingClientRect();
        return { listTop: list.top, listRight: list.right, firstTop: firstItem.top,
          firstBottom: firstItem.bottom, toolsTop: tools.top, toolsRight: tools.right,
          toolsBottom: tools.bottom, inspectorTop: inspector.top, inspectorBottom: inspector.bottom,
          inspectorLeft: inspector.left, dockTop: dock.top };
      });
      assert.ok(aboveFold.firstTop <= Math.min(aboveFold.toolsTop, aboveFold.inspectorTop) + 25,
        'First inventory row must start beside the right rail, not after it: ' + JSON.stringify(aboveFold));
      assert.ok(aboveFold.firstBottom < aboveFold.dockTop - 8,
        'First inventory row must be visible above the persistent party dock: ' + JSON.stringify(aboveFold));
      assert.ok(aboveFold.listRight <= aboveFold.inspectorLeft + 2,
        'Inventory list must remain left of the filter/inspector rail: ' + JSON.stringify(aboveFold));
      if (width >= 1200) {
        assert.ok(aboveFold.inspectorTop < aboveFold.dockTop - 100,
          'Selected item details must begin visibly above the persistent party dock: ' + JSON.stringify(aboveFold));
        assert.ok(aboveFold.toolsTop >= aboveFold.inspectorBottom - 3,
          'Optional filters should follow, not obscure, the selected item details: ' + JSON.stringify(aboveFold));
      } else {
        assert.ok(aboveFold.inspectorTop >= aboveFold.toolsBottom - 3,
          'At 1024px the validated filter-first layout must remain intact: ' + JSON.stringify(aboveFold));
      }
      const filterDisclosure = equipment.locator('.chronicles-character-sheet__backpack-tools');
      assert.equal(await filterDisclosure.evaluate((node) => node.open), false,
        'Filter/search must start collapsed to avoid another tall inspector column');
      await filterDisclosure.locator('summary').click();
      assert.equal(await filterDisclosure.evaluate((node) => node.open), true);
      if (width >= 1200) {
        const filters = await equipment.locator('.chronicles-character-sheet__backpack-filters')
          .evaluate((group) => {
            const buttons = [...group.querySelectorAll('button')];
            const boxes = buttons.map((button) => button.getBoundingClientRect());
            const rows = new Set(boxes.map((rect) => Math.round(rect.top))).size;
            const search = group.closest('.chronicles-character-sheet__backpack-tools')
              .querySelector('.chronicles-character-sheet__backpack-search').getBoundingClientRect();
            return { buttons: buttons.length,
              columns: getComputedStyle(group).gridTemplateColumns.split(' ').filter(Boolean).length,
              rows, minimumHeight: Math.min(...boxes.map((box) => box.height)),
              groupBottom: group.getBoundingClientRect().bottom, searchTop: search.top };
          });
        assert.equal(filters.columns, 2, 'Wide desktop filters must show two real columns');
        assert.ok(filters.buttons >= 3 && filters.rows <= Math.ceil(filters.buttons / 2),
          'All inventory categories must fit a compact filter grid: ' + JSON.stringify(filters));
        assert.ok(filters.minimumHeight >= 44,
          'Compact filter chips must still provide 44px hit targets: ' + JSON.stringify(filters));
        assert.ok(filters.searchTop >= filters.groupBottom - 2,
          'Search must follow, not overlap, the filters: ' + JSON.stringify(filters));
      }
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
      // Reusing the same scrollable inventory node must not preserve a stale
      // scroll offset after a filter/search change (especially with a narrow
      // inspector rail). Force a small visible list to exercise real scrolling.
      const filters = equipment.getByRole('group', { name: 'Filtrar objetos por ranura' });
      const search = equipment.getByRole('searchbox', { name: 'Buscar en la mochila' });
      await inv.evaluate((node) => {
        node.style.minHeight = '0px';
        node.style.maxHeight = '55px';
        node.scrollTop = node.scrollHeight;
      });
      assert.ok(await inv.evaluate((node) => node.scrollTop) > 0,
        'Fixture must genuinely scroll before exercising a filter change');
      await filters.getByRole('button', { name: /Escudos/ }).click();
      assert.ok(await rows.count() >= 1, 'The real inventory includes a shield');
      assert.equal(await inv.evaluate((node) => node.scrollTop), 0,
        'Changing backpack category must reset stale list scroll');
      await filters.getByRole('button', { name: /Todos/ }).click();
      await inv.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      assert.ok(await inv.evaluate((node) => node.scrollTop) > 0);
      await search.fill('bronce');
      assert.ok(await rows.count() >= 1, 'Real equipment includes bronze items');
      assert.equal(await inv.evaluate((node) => node.scrollTop), 0,
        'Searching backpack must reset the scroll to the first matching object');
      await search.clear();
      await inv.evaluate((node) => {
        node.style.removeProperty('min-height');
        node.style.removeProperty('max-height');
      });

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
      assert.deepEqual(await spellRows.evaluateAll((nodes) =>
        nodes.map((node) => node.tabIndex)),
        Array.from({ length: actualCount }, (_, index) => index === 0 ? 0 : -1),
        'Exactly one spell should be reachable by Tab, with arrows navigating the rest');
      assert.match(await grimoire.getByRole('region', { name: 'Detalle del hechizo seleccionado' }).innerText(), /PH/);
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

      // The compact MM3 training ledger can now fit without scrolling on
      // every tested desktop. Still exercise restoration with a genuinely long
      // dossier: duplicate *real* skill cards only inside the browser smoke
      // fixture, marked inert/aria-hidden, not in production or game state.
      const scrollArea = sheet.locator('.chronicles-character-sheet__scroll');
      const ensureLongTrainingFixture = async () => {
        const capacity = await scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
        if (capacity > 120 || width !== 1280) return capacity;
        await sheet.locator('[data-chronicles-training="skills"] .chronicles-character-sheet__skill-grid')
          .evaluate((grid) => {
            const cards = [...grid.querySelectorAll(':scope > button:not([data-smoke-overflow])')];
            for (let batch = 0; batch < 12; batch += 1) {
              for (const card of cards) {
                const clone = card.cloneNode(true);
                clone.disabled = true;
                clone.tabIndex = -1;
                clone.setAttribute('aria-hidden', 'true');
                clone.dataset.smokeOverflow = 'true';
                grid.appendChild(clone);
              }
            }
          });
        return scrollArea.evaluate((node) => node.scrollHeight - node.clientHeight);
      };
      const availableScroll = await ensureLongTrainingFixture();
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
        await ensureLongTrainingFixture();

        // A hero switch is not a folio change: the React modal remains mounted.
        // Force scroll again and use a native dock click, avoiding Playwright
        // autoscroll so only the production hero-change effect can reset it.
        await scrollArea.evaluate((node) => {
          node.scrollTop = Math.min(220, node.scrollHeight - node.clientHeight);
        });
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) > 60,
          'Training must really be scrolled before switching the viewed hero');
        await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' })
          .evaluate((node) => node.click());
        await page.waitForFunction(() => document.querySelector(
          '#chronicles-character-sheet-title'
        )?.textContent === 'Hildegard');
        assert.ok(await scrollArea.evaluate((node) => node.scrollTop) <= 2,
          'A new hero must not inherit the previous hero desktop folio offset');
        assert.equal(await nav.getByRole('button', { name: /Mejoras/ }).getAttribute('aria-pressed'), 'true',
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
  // MM3's 1–4 handoff on a real mounted React sheet + actual campaign
  // reducer: preview != selection, keyboard and touch transfer exactly one
  // item, no switching heroes by accident, no inventory multiplication.
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
      await sword.click();
      assert.equal(await sword.getAttribute('aria-pressed'), 'true');
      assert.equal(await dock.getByRole('button', { name: /Entregar 1 .* a Hildegard/ }).count(), 1);
      const hint = sheet.locator('.chronicles-character-sheet__inventory-hint');
      assert.match(await hint.innerText(), /elige destino con 1–4/);
      // Pressed key 2 consumes the selection for one handoff, not a hero switch.
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Matthias', 'Giving an item does not open the recipient sheet');
      assert.equal(await sword.count(), 0, 'Exactly one sword leaves Matthias bag');
      assert.equal(await sheet.locator('.chronicles-character-sheet__item-details').count(), 1);
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Hildegard', 'After handoff, number keys navigate again');
      const recipientBag = sheet.locator('.chronicles-character-sheet__inventory');
      const receivedSword = recipientBag.locator('[data-inventory-item="bronze-sword"]');
      await receivedSword.waitFor({ state: 'visible' });
      assert.equal(await receivedSword.count(), 1, 'Sword arrives intact in Hildegard bag');
      await receivedSword.click();
      // A tap/click on slot 1 is the other supported transfer path.
      await dock.getByRole('button', { name: /Entregar 1 .* a Matthias/ }).click();
      assert.equal(await heading.innerText(), 'Hildegard');
      assert.equal(await receivedSword.count(), 0);
      await page.keyboard.press('1');
      assert.equal(await heading.innerText(), 'Matthias');
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 1,
        'The same sword returns without duplication');
      // Numbers typed in a search field must never cause a transfer.
      await bag.locator('[data-inventory-item="bronze-sword"]').click();
      // Search is an optional disclosure, not an always-visible tall panel.
      await sheet.locator('.chronicles-character-sheet__backpack-tools > summary').click();
      const search = sheet.getByRole('searchbox', { name: 'Buscar en la mochila' });
      await search.focus();
      await page.keyboard.press('2');
      assert.equal(await heading.innerText(), 'Matthias');
      await search.clear();
      assert.equal(await bag.locator('[data-inventory-item="bronze-sword"]').count(), 1);
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
      await page.keyboard.press('2');
      assert.equal(await sheet.locator('#chronicles-character-sheet-title').innerText(), 'Matthias');
      assert.equal(await sword.count(), 1, 'A combat-time transfer is not allowed');
      console.log('MM3_MANUAL_HANDOFF_COMBAT_GUARD_OK');
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
      assert.equal(geometry.dockPortraits, 0, 'No full portraits in mobile sheet selector');
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
      await equipmentTab.click();
      await sheet.locator('[data-chronicles-equipment-folio] [data-inventory-item]').first()
        .waitFor({ state: 'visible' });
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
        assert.ok(scrollCapacity > 80, 'Populated phone dossier must genuinely scroll');
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
        await page.screenshot({ path: 'smoke-character-sheet-backpack-' + width + '.png' });
      }
      assert(await equipmentTab.evaluate((node) => node.getBoundingClientRect().height)
        >= (height <= 480 ? 34 : 44), 'Touch equipment tab must remain usable');
      await nav.getByRole('button', { name: /Hechizos/ }).click();
      await sheet.getByRole('button', { name: 'Ver ficha de Hildegard' }).click();
      assert.equal(await nav.getByRole('button', { name: /Hechizos/ }).getAttribute('aria-pressed'), 'true',
        'Changing party member must retain chosen folio on touch devices');
      await nav.getByRole('button', { name: /Equipo/ }).click();
      assert(await sheet.locator('[data-chronicles-equipment-folio]').isVisible());
      const equipmentSubtitle = sheet.locator(
        '[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head > div > small'
      );
      assert.match(await equipmentSubtitle.textContent(), /Qué llevas y qué tienes puesto/);
      assert.equal(await equipmentSubtitle.isVisible(), width > 430,
        'Only narrow touch phones omit the redundant Equipment subtitle');
      const companyGoldChip = sheet.locator('.chronicles-character-sheet__quick [data-resource="gold"]');
      const repeatedEquipmentGold = sheet.locator(
        '[data-chronicles-equipment-folio] > .chronicles-character-sheet__section-head > b'
      );
      assert.equal(await companyGoldChip.isVisible(), true,
        'The primary company gold balance must remain visible in the identity strip');
      assert.equal(await repeatedEquipmentGold.count(), 0,
        'MM3 already shows company gold in the identity strip; do not repeat it in Equipment');
      if (width <= 520) {
        const emptyWeapons = await sheet.locator(
          '[data-chronicles-equipment-folio] .chronicles-character-sheet__weapon-card:not(:has(> button))'
        ).evaluateAll((cards) => cards.map((card) => {
          const label = card.querySelector('b');
          const value = card.querySelector('strong');
          const explanation = card.querySelector('small');
          return {
            slot: card.dataset.slot,
            height: card.getBoundingClientRect().height,
            sameRow: Math.abs(label.getBoundingClientRect().top - value.getBoundingClientRect().top) <= 4,
            clipped: [card, label, value, explanation].some((el) => el.scrollWidth > el.clientWidth + 1),
            label: label.textContent.trim(),
            value: value.textContent.trim(),
            explanation: explanation.textContent.trim(),
          };
        }));
        assert.deepEqual(emptyWeapons.map(({ slot }) => slot), ['weapon', 'missile'],
          'Fixture must exercise both genuinely empty A/S slots');
        assert.ok(emptyWeapons.every(({ sameRow, height, clipped }) => sameRow && height <= 110 && !clipped),
          'Empty mobile weapon slots must fit on two readable rows: ' + JSON.stringify(emptyWeapons));
        assert.ok(emptyWeapons.every(({ value, explanation }) => value === 'Sin equipar' && explanation.length > 0),
          'Compacting empty slots must retain their meaningful status and stats');
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
        assert.ok(identity.title.right <= identity.description.left + 1
          || identity.title.bottom <= identity.description.top + 1,
        'Landscape hero name and class must not collide: ' + JSON.stringify(identity));
        assert.ok(identity.resources.top >= Math.max(identity.title.bottom, identity.description.bottom) - 1,
          'Landscape resource chips must sit below identity text: ' + JSON.stringify(identity));
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