// Browser-verified mobile folio contract; screenshots are CI artifacts.
// Uses source components from the real game, not copies of their markup.
// Launches in Chromium against a temporary local Vite server, no user account.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { assertAdventureFolioInk } from './adventure-contrast.mjs';

const base = process.argv[2] || 'http://localhost:4174/smoke/folio-mobile.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
let failures = 0;

try {
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [844, 390], [1280, 800]]) {
    for (const view of width === 1280 ? ['cast', 'adventure', 'healing', 'revive', 'rescue'] : ['cast', 'items', 'adventure', 'healing', 'revive', 'rescue']) {
      const ctx = await browser.newContext({
        viewport: { width, height }, isMobile: true, hasTouch: true,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      try {
        // 27 fixture navigations previously paid Playwright's 500ms networkidle
        // quiet window even after the actual dialog was rendered. Wait for
        // load + the real dialog + paint resources, never a speculative sleep.
        await page.goto(base + '?view=' + view, { waitUntil: 'load' });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible', timeout: 20_000 });
        await page.waitForFunction(() => {
          const visible = [...document.images].filter((img) => img.getClientRects().length);
          return document.fonts.status === 'loaded'
            && visible.every((img) => img.complete && img.naturalWidth > 0);
        }, undefined, { timeout: 15_000 });
        const details = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          const content = d.querySelector('.chronicles-spell-menu__pages')
            || d.querySelector('.chronicles-game-menu__folio-columns');
          const dr = d.getBoundingClientRect();
          const cr = content.getBoundingClientRect();
          return {
            vw: window.innerWidth, vh: window.innerHeight,
            fullWidth: document.documentElement.scrollWidth,
            left: dr.left, right: dr.right, top: dr.top, bottom: dr.bottom,
            contentWidth: content.scrollWidth, contentClient: content.clientWidth,
            contentHeight: cr.height,
          };
        });
        assert(details.left >= -1 && details.right <= details.vw + 1,
          `${view} ${width} dialog escapes viewport: ${JSON.stringify(details)}`);
        assert(details.top >= -1 && details.bottom <= details.vh + 1,
          `${view} ${width} dialog clipped vertically: ${JSON.stringify(details)}`);
        assert(details.fullWidth <= details.vw + 1,
          `${view} ${width} horizontal document overflow: ${JSON.stringify(details)}`);
        assert(details.contentWidth <= details.contentClient + 1,
          `${view} ${width} contents overflow sideways: ${JSON.stringify(details)}`);
        assert(details.contentHeight > 40, `${view} ${width} contents unusable`);
        const buttons = await dialog.locator('button').evaluateAll((all) => all
          .filter((button) => !button.disabled && button.getClientRects().length)
          .map((button) => {
            const rect = button.getBoundingClientRect();
            return { label: button.getAttribute('aria-label') || button.textContent.trim().slice(0,45),
              width:rect.width,height:rect.height };
          }));
        const undersized = buttons.filter((button) => button.height < 39 || button.width < 38);
        assert.deepEqual(undersized, [], `${view} ${width} touch target too small`);
        assert.deepEqual(errors, [], `${view} ${width} browser exceptions`);
        if (view === 'cast' || view === 'items') {
          const footer = await dialog.locator('.chronicles-spell-menu__folio-footer').evaluate((node) => ({
            shortcutDisplay: getComputedStyle(node.querySelector('kbd')).display,
            coarse: matchMedia('(pointer: coarse)').matches,
            lineHeight: parseFloat(getComputedStyle(node).lineHeight),
            overflow: node.scrollWidth > node.clientWidth + 1,
          }));
          const compactTouch = width <= 520 && footer.coarse;
          assert.equal(footer.shortcutDisplay === 'none', compactTouch,
            `CAST/items keyboard footer at ${width}px: ${JSON.stringify(footer)}`);
          assert.equal(footer.overflow, false,
            `CAST/items footer must not overflow at ${width}px: ${JSON.stringify(footer)}`);
          if (compactTouch) assert(footer.lineHeight >= 20,
            `CAST/items touch usage note needs readable line spacing: ${JSON.stringify(footer)}`);
          if (view === 'cast' && width <= 430) {
            const copy = await dialog.locator('.chronicles-spell-menu__entry small').first()
              .evaluate((node) => {
                const style = getComputedStyle(node);
                return { family: style.fontFamily, size: parseFloat(style.fontSize),
                  lineHeight: parseFloat(style.lineHeight),
                  overflow: node.scrollWidth > node.clientWidth + 1 };
              });
            assert.match(copy.family, /system-ui/i, 'Spell descriptions use a legible phone text face');
            assert(copy.size >= 17 && copy.lineHeight >= 20 && !copy.overflow,
              `CAST descriptive copy must be readable without clipping: ${JSON.stringify(copy)}`);
            const usage = await dialog.locator('.chronicles-spell-menu__folio-footer')
              .evaluate((node) => getComputedStyle(node).fontFamily);
            assert.match(usage, /system-ui/i, 'CAST usage note uses the same readable text face');
          }
        }
        if (view === 'adventure') {
          await assertAdventureFolioInk(dialog, `${width}x${height}`);
          // A touch-sized pause folio has an Ayuda control; its repeated
          // keyboard legend should not steal vertical space from actions.
          const footer = await dialog.locator('.chronicles-game-menu__hint').evaluate((node) => ({
            display: getComputedStyle(node).display,
            height: node.getBoundingClientRect().height,
            coarse: matchMedia('(pointer: coarse)').matches,
          }));
          const compactTouch = width <= 620 && footer.coarse;
          assert.equal(footer.display === 'none', compactTouch,
            `Adventure keyboard legend visibility at ${width}px: ${JSON.stringify(footer)}`);
          if (compactTouch) assert.equal(footer.height, 0,
            'Hidden keyboard legend must free actual vertical space');
          assert.equal(await dialog.getByRole('button', { name: /Ayuda/ }).isVisible(), true,
            'Touch users still need the visible help action');
          const board = await dialog.evaluate((node) => {
            const primary = node.querySelector('.chronicles-game-menu__primary-row');
            const rows = [...node.querySelectorAll('.chronicles-game-menu__action-pair')];
            const utility = node.querySelector('.chronicles-game-menu__utility-row');
            const bounds = (element) => element.getBoundingClientRect();
            const sameEdges = (a, b) => Math.abs(bounds(a).left - bounds(b).left) <= 1
              && Math.abs(bounds(a).right - bounds(b).right) <= 1;
            return {
              primaryActions: primary.children.length,
              kickerHidden: getComputedStyle(node.querySelector('.chronicles-game-menu__section-kicker')).display === 'none',
              primaryHorizontal: Math.abs(bounds(primary.children[0]).top
                - bounds(primary.children[1]).top) <= 1,
              rows: rows.length,
              sameEdges: [primary, ...rows].every((row) => sameEdges(row, utility)),
              journalHorizontal: Math.abs(bounds(rows[0].children[0]).top
                - bounds(rows[0].children[1]).top) <= 1,
              saveHorizontal: Math.abs(bounds(rows[1].children[0]).top
                - bounds(rows[1].children[1]).top) <= 1,
              saveExitSameRow: Math.abs(bounds(rows[1].children[1]).top
                - bounds(rows[1].children[2]).top) <= 1,
              utilityHasExit: !!utility.querySelector('.chronicles-game-menu__leave'),
              utilitySingleRow: Math.abs(bounds(utility.firstElementChild).top
                - bounds(utility.lastElementChild).top) <= 1,
              minTargetHeight: Math.min(...[...node.querySelectorAll(
                '.chronicles-game-menu__primary-row button, .chronicles-game-menu__action-pair button, .chronicles-game-menu__utility-row button'
              )].map((button) => bounds(button).height)),
              noHorizontalOverflow: node.scrollWidth <= node.clientWidth + 1,
            };
          });
          assert.equal(board.primaryActions, 2, 'Continue and rest share a semantic row');
          assert.equal(board.kickerHidden, true, 'Default pause board should not waste a separate expedition heading');
          assert.equal(board.rows, 2, 'Journal/status and save/load/exit remain grouped');
          assert.equal(board.sameEdges, true, 'All control-board rows align horizontally');
          assert.equal(board.primaryHorizontal, width > 650,
            'Continue and camp rest sit side by side only where readable');
          assert.equal(board.journalHorizontal, width > 430,
            'Journal and status stack only on narrow phones');
          assert.equal(board.saveHorizontal, true, 'Save and load remain directly comparable');
          assert.equal(board.saveExitSameRow, width > 650,
            'Save and exit form three columns only where room allows');
          assert.equal(board.utilityHasExit, true, 'Unsafe exit remains in the last row');
          assert.equal(board.utilitySingleRow, width > 650,
            'Wider control boards must fit all utilities, including exit, on one row');
          assert.ok(board.minTargetHeight >= 44 && board.noHorizontalOverflow,
            'Tactile controls must fit without horizontal overflow: ' + JSON.stringify(board));
          // Expanded sound scrolls a short landscape folio. Reset before
          // saving the canonical open-menu screenshot so it depicts the
          // initial cover/header rather than the last scrolled menu row.
          await dialog.evaluate((element) => { element.scrollTop = 0; });
        }
        await page.screenshot({ path: `smoke-folio-${view}-${width}.png` });
        if(view === 'cast') {
          if (width <= 430) {
            const tabLines = await dialog.locator('.chronicles-spell-menu__tabs button')
              .evaluateAll((buttons) => buttons.map((button) => {
                const shortcut = button.querySelector('small');
                const label = document.createRange();
                label.selectNodeContents(button.firstChild);
                const labelBounds = label.getBoundingClientRect();
                const shortcutBounds = shortcut.getBoundingClientRect();
                return {
                  labelTop: labelBounds.top,
                  shortcutTop: shortcutBounds.top,
                  shortcutRight: shortcutBounds.right,
                  buttonRight: button.getBoundingClientRect().right,
                  scrollWidth: button.scrollWidth,
                  clientWidth: button.clientWidth,
                };
              }));
            assert.equal(tabLines.length, 2, 'CAST has two page tabs');
            assert(tabLines.every((tab) => Math.abs(tab.labelTop - tab.shortcutTop) <= 8
              && tab.shortcutRight <= tab.buttonRight - 2
              && tab.scrollWidth <= tab.clientWidth + 1),
            `CAST page labels and C/I shortcuts must stay on one line at ${width}px: ${JSON.stringify(tabLines)}`);
          }
          if (width <= 430) {
            const description = await dialog.locator('.chronicles-spell-menu__entry small')
              .first().evaluate((node) => {
                const style = getComputedStyle(node);
                return {
                  fontSize: parseFloat(style.fontSize),
                  lineHeight: parseFloat(style.lineHeight),
                  scrollHeight: node.scrollHeight,
                  clientHeight: node.clientHeight,
                };
              });
            assert(description.fontSize >= 17 && description.lineHeight >= 20,
              `CAST mobile spell copy is too small: ${JSON.stringify(description)}`);
            assert(description.scrollHeight <= description.clientHeight + 1,
              `CAST mobile spell copy is clipped: ${JSON.stringify(description)}`);
          }
          await dialog.getByRole('tab', { name: /Objetos/ }).click();
          await page.locator('[data-chronicles-use-item="healing-potion"]').waitFor();
          // The original regression appeared only after switching pages
          // with the full items list in 844x390 landscape.
          const changed = await dialog.boundingBox();
          assert(changed.y >= -1 && changed.y + changed.height <= height + 1,
            `CAST→items viewport escape ${width}x${height}: ${JSON.stringify(changed)}`);
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
        }
        if (view === 'healing') {
          await dialog.locator('[data-chronicles-cast="first-aid"]').click();
          const picker = dialog.locator('[data-chronicles-heal-picker="first-aid"]');
          await picker.waitFor({ state: 'visible' });
          const fallen = picker.locator('[data-chronicles-heal-target="rook"]');
          const wounded = picker.locator('[data-chronicles-heal-target="matthias"]');
          assert.equal(await fallen.isDisabled(), true, '0 PV must not be curable');
          assert.equal(await wounded.isEnabled(), true, 'Living wounded ally must be a valid target');
          assert.match(await picker.innerText(), /Elixir de retorno/);
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Choosing a spell alone must not spend a turn or cast');
          const fit = await picker.evaluate((node) => ({
            width: node.scrollWidth, clientWidth: node.clientWidth,
          }));
          assert(fit.width <= fit.clientWidth + 2,
            'Healing targets overflow the grimoire: ' + JSON.stringify(fit));
          await page.screenshot({ path: `smoke-folio-healing-targets-${width}.png` });
          await wounded.click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'cast:first-aid:matthias');
          assert.equal((await page.locator('[data-test-result]').textContent()).trim(),
            'cast:first-aid:matthias');
        }
        if (view === 'revive') {
          await dialog.locator('[data-chronicles-use-item="revive-draught"]').click();
          const picker = dialog.locator('[data-chronicles-revive-picker="revive-draught"]');
          await picker.waitFor({ state: 'visible' });
          const fallen = picker.locator('[data-chronicles-revive-target="rook"]');
          const living = picker.locator('[data-chronicles-revive-target="matthias"]');
          assert.equal(await fallen.isEnabled(), true, '0 PV ally must be eligible for revival');
          assert.equal(await living.isDisabled(), true, 'living ally cannot consume revival elixir');
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Opening the revive picker must not consume an elixir');
          const fit = await picker.evaluate((node) => ({
            width: node.scrollWidth, clientWidth: node.clientWidth,
          }));
          assert(fit.width <= fit.clientWidth + 2,
            'Revive picker overflows: ' + JSON.stringify(fit));
          await page.screenshot({ path: `smoke-folio-revive-targets-${width}.png` });
          await fallen.click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'use:revive-draught:rook');
          assert.equal((await page.locator('[data-test-result]').textContent()).trim(),
            'use:revive-draught:rook');
        }
        if (view === 'rescue') {
          await dialog.locator('[data-chronicles-cast="first-aid"]').click();
          const healPicker = dialog.locator('[data-chronicles-heal-picker="first-aid"]');
          await healPicker.waitFor({ state: 'visible' });
          assert.match(await healPicker.innerText(), /Llevas 1 Elixir de retorno/);
          await healPicker.locator('[data-chronicles-open-revive]').click();
          const revivePicker = dialog.locator('[data-chronicles-revive-picker="revive-draught"]');
          await revivePicker.waitFor({ state: 'visible' });
          assert.equal(await dialog.getAttribute('data-chronicles-menu-tab'), 'items');
          assert.equal(await page.locator('[data-test-result]').textContent(), '',
            'Switching from healing to revival cannot spend items or turn');
          await page.screenshot({ path: `smoke-folio-healing-to-revive-${width}.png` });
          await revivePicker.locator('[data-chronicles-revive-target="rook"]').click();
          await page.waitForFunction(() =>
            document.querySelector('[data-test-result]')?.textContent?.trim()
              === 'use:revive-draught:rook');
        }
        if(view === 'adventure') {
          const helpTrigger = dialog.locator('[data-chronicles-menu-help]');
          await helpTrigger.click();
          const help = dialog.locator('[data-chronicles-game-help]');
          await help.waitFor({ state: 'visible' });
          assert.equal(await help.locator('details').count(), 4,
            'Help must explain game concepts from the pause menu');
          // Closed <details> sections hide their contents in the rendered UI.
          // Open each relevant section as a real user would before asserting
          // visible copy, so the smoke checks progressive disclosure honestly.
          // The first section starts open; its visible CA definition must remain.
          assert.match(await help.innerText(), /CA · Armadura/);
          await help.getByText('Equipo, compras y comparaciones').click();
          assert.match(await help.innerText(), /Comprar guarda el artículo/);
          assert.doesNotMatch(await help.innerText(), /MM3/);
          assert.equal(await dialog.locator('[data-chronicles-menu-save]').count(), 0,
            'Menu actions must not compete with the guide');
          await page.screenshot({ path: `smoke-folio-help-${width}.png` });
          await help.getByRole('button', { name: 'Volver al menú' }).click();
          await help.waitFor({ state: 'hidden' });
          await dialog.locator('[data-chronicles-menu-save]').waitFor({ state: 'visible' });
          assert.equal(await helpTrigger.evaluate((node) => document.activeElement === node), true,
            'Closing help restores focus to its trigger');
          await dialog.getByRole('button', { name: 'Salir sin guardar' }).click();
          await dialog.getByRole('group', { name: 'Confirmar salida sin guardar' }).waitFor();
          await dialog.getByRole('button', { name: 'Cancelar' }).click();
          await dialog.getByRole('group', { name: 'Confirmar salida sin guardar' })
            .waitFor({ state: 'hidden' });
        }
        console.log(`FOLIO_VIEWPORT_OK view=${view} width=${width} height=${height}`);
      } catch (error) {
        failures++;
        console.log(`FOLIO_VIEWPORT_FAIL view=${view} width=${width}: ${error.message}`);
      } finally {
        await ctx.close();
      }
    }
  }

  // Dedicated desktop screenshot: proportions and uninterrupted folio rules.
  // The mobile matrix above keeps its original 27 combinations unchanged.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.goto(base + '?view=adventure', { waitUntil: 'load' });
      const menu = page.getByRole('dialog', { name: 'Menú de aventura' });
      await menu.waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForFunction(() => document.fonts.status === 'loaded');
      const shape = await menu.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const pairs = [...node.querySelectorAll('.chronicles-game-menu__action-pair')];
        const utility = node.querySelector('.chronicles-game-menu__utility-row');
        const buttons = pairs[0]?.querySelectorAll('button');
        return {
          width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
          twoColumns: buttons?.length === 2 && Math.abs(buttons[0].getBoundingClientRect().top
            - buttons[1].getBoundingClientRect().top) < 1,
          allAligned: pairs.every((row) => Math.abs(row.getBoundingClientRect().left
            - utility.getBoundingClientRect().left) < 1
            && Math.abs(row.getBoundingClientRect().right - utility.getBoundingClientRect().right) < 1),
          noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        };
      });
      assert.ok(shape.width >= 600 && shape.width / shape.height >= 1.1,
        `Desktop menu should be a wider, shorter folio: ${JSON.stringify(shape)}`);
      assert.ok(shape.twoColumns && shape.allAligned, 'Desktop action rows stay aligned in two columns');
      assert.ok(shape.right <= 1281 && shape.bottom <= 801 && shape.noHorizontalScroll,
        'Desktop folio must fit the screen');
      await page.screenshot({ path: 'smoke-folio-adventure-desktop-1280.png' });
      console.log('ADVENTURE_FOLIO_DESKTOP_OK');
    } catch (error) {
      failures++;
      console.error(`ADVENTURE_FOLIO_DESKTOP_FAIL: ${error.message}`);
    } finally {
      await ctx.close();
    }
  }

  // Structural replica with the same selectors/CSS as the production HUD.
  // Objectives belong to the Crónica, not a persistent overlay on the scene.
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [768, 354], [844, 390], [1024, 600]]) {
    const ctx = await browser.newContext({
      viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(base + '?view=compact-hud', { waitUntil: 'load' });
      await page.locator('[data-chronicles-journal-trigger]').waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForFunction(() => document.fonts.status === 'loaded');
      const geometry = await page.evaluate(() => {
        const journal = document.querySelector('[data-chronicles-journal-trigger]');
        const group = document.querySelector('[data-chronicles-quick-status-trigger]');
        const faces = [...document.querySelectorAll('.chronicles-party-member')];
        if (!journal || !group || faces.length !== 4) return null;
        const buttons = [journal, group].map((node) => node.getBoundingClientRect());
        const faceRects = faces.map((node) => node.getBoundingClientRect());
        return {
          navBottom: Math.max(...buttons.map((rect) => rect.bottom)),
          partyTop: Math.min(...faceRects.map((rect) => rect.top)),
          partyLeft: Math.min(...faceRects.map((rect) => rect.left)),
          partyRight: Math.max(...faceRects.map((rect) => rect.right)),
          buttonMinHeight: Math.min(...buttons.map((rect) => rect.height)),
          navRight: Math.max(...buttons.map((rect) => rect.right)),
          noObjective: !document.querySelector('[data-chronicles-objective], .chronicles-objective-trigger'),
          noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
        };
      });
      assert.ok(geometry, 'Crónica/Grupo and four selectable heroes exist');
      assert.ok(geometry.noObjective, 'No permanent objective plaque');
      assert.ok(geometry.navBottom + 4 <= geometry.partyTop,
        `Navigation must not cover heroes at ${width}x${height}: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.buttonMinHeight >= 44, 'Journal/group must remain touchable');
      assert.ok(geometry.navRight <= width - 60,
        `Leave room for the top-right menu gem at ${width}x${height}: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.partyLeft >= -1 && geometry.partyRight <= width + 1, 'Heroes fit screen');
      assert.ok(geometry.noHorizontalOverflow, 'HUD must not scroll sideways');
      await page.screenshot({ path: `smoke-compact-hud-${width}.png` });
      console.log(`COMPACT_PARTY_HUD_OK ${width}x${height}`);
    } catch (error) {
      failures++;
      console.error(`COMPACT_PARTY_HUD_FAIL ${width}x${height}: ${error.message}`);
    } finally {
      await ctx.close();
    }
  }

  // Desktop MM3: exploration retains its large original hero portraits.
  // Only the character-sheet/equipment dock is allowed to compact them.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.goto(base + '?view=compact-hud', { waitUntil: 'load' });
      await page.locator('.chronicles-party-member').first().waitFor({ state: 'visible', timeout: 20_000 });
      const portraitHeight = await page.locator('.chronicles-party-member .chronicles-party-glyph').first()
        .evaluate((node) => node.getBoundingClientRect().height);
      assert.ok(portraitHeight >= 84 && portraitHeight <= 170,
        `Exploration hero portraits must keep original scale: ${portraitHeight}`);
      await page.screenshot({ path: 'smoke-compact-hud-desktop.png' });
      console.log('EXPLORATION_PARTY_PORTRAITS_OK');
    } catch (error) {
      failures++;
      console.error(`COMPACT_PARTY_HUD_DESKTOP_FAIL: ${error.message}`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
