// CI-only component captures. No fake combat, seeded rewards or backend writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/first-hour-contact.html';
const browser = await chromium.launch();
const failures = [];

// Retry one transient Chromium navigation cancellation only; never rerun
// assertions, suppress a script error or turn two aborted navigations green.
async function gotoFixture(page, target) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(target, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      if (attempt || page.isClosed() || !String(error.message).includes('net::ERR_ABORTED')) throw error;
      console.warn('CHRONICLES_FIXTURE_NAV_RETRY reason=ERR_ABORTED once=1');
      await page.waitForTimeout(180);
    }
  }
}
try {
  for (const width of [360, 390, 430, 800, 1280]) {
    const height = width === 800 ? 440 : width === 1280 ? 800 : 844;
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url + '?view=threat', { waitUntil: 'domcontentloaded' });
      const cue = page.locator('[data-chronicles-first-threat]');
      await cue.waitFor({ state: 'visible', timeout: 20000 });
      assert.ok(await page.locator('body').getAttribute('data-enemy-id'),
        'Must use an actual enemy from the road map');
      const info = await page.evaluate(() => {
        const node = document.querySelector('[data-chronicles-first-threat]');
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          overflowing: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.equal(info.overflowing, false);
      assert.ok(info.left >= -1 && info.top >= -1
        && info.right <= width + 1 && info.bottom <= height + 1,
      JSON.stringify(info));
      // Help must name the REAL input a player can see. A mobile screen
      // without a physical keyboard must not show an S-only combat tip.
      const touchHint = width <= 600;
      const threatKeyboard = cue.locator('.chronicles-first-threat__keyboard-hint');
      const threatTouch = cue.locator('.chronicles-first-threat__touch-hint');
      assert.equal(await threatKeyboard.first().isVisible(), !touchHint,
        'Keyboard combat hint visibility at ' + width);
      assert.equal(await threatTouch.first().isVisible(), touchHint,
        'Touch combat hint visibility at ' + width);
      if (touchHint) {
        assert.match(await cue.innerText(), /SALVA/);
        assert.match(await cue.innerText(), /ATACAR/);
      }
      await page.screenshot({ path: 'smoke-first-threat-' + width + '.png' });

      await page.goto(url + '?view=guides', { waitUntil: 'domcontentloaded' });
      const steps = page.locator('[data-chronicles-first-steps]');
      await steps.waitFor({ state: 'visible', timeout: 20000 });
      assert.equal(await steps.locator('.chronicles-first-steps__touch-hint').isVisible(), touchHint,
        'Touch movement hint visibility at ' + width);
      assert.equal(await steps.locator('.chronicles-first-steps__keyboard-hint').isVisible(), !touchHint,
        'Keyboard movement hint visibility at ' + width);
      if (touchHint) {
        assert.match(await steps.innerText(), /minimapa/);
        assert.match(await steps.innerText(), /Crónica/);
      }
      await page.screenshot({ path: 'smoke-first-steps-' + width + '.png' });

      // A real action at Aldric's door remains tappable. The hardware-only F
      // hint is omitted on mobile, but kept for mouse/keyboard players.
      await page.goto(url + '?view=mayor', { waitUntil: 'domcontentloaded' });
      const mayor = page.locator('[data-chronicles-first-audience]');
      await mayor.waitFor({ state: 'visible', timeout: 20000 });
      assert.equal(await mayor.locator('kbd').isVisible(), !touchHint,
        'Physical F key should only be suggested with keyboard layout');
      const mayorBounds = await mayor.boundingBox();
      assert.ok(mayorBounds && mayorBounds.x >= -1 && mayorBounds.x + mayorBounds.width <= width + 1,
        'Mayor invitation must fit the viewport: ' + JSON.stringify(mayorBounds));
      await page.screenshot({ path: 'smoke-first-mayor-' + width + '.png' });
      await mayor.getByRole('button', { name: 'Entrar y hablar con el alcalde Aldric' }).click();
      assert.equal(await page.locator('body').getAttribute('data-mayor-action-requested'), 'true',
        'Click must reach the existing mayor interaction callback');
      await page.goto(url + '?view=threat', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Entendido' }).click();
      assert.equal(await cue.count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await cue.count(), 0,
        'Dismissal must survive refresh for the same run');

      await page.goto(url + '?view=payment', { waitUntil: 'domcontentloaded' });
      // A pointer left on the previous tab must not pre-open a new narration.
      await page.mouse.move(width - 6, 6);
      const bark = page.locator('.chronicles-party-bark');
      const barkTab = bark.locator('.chronicles-party-bark__trigger');
      const barkDetails = bark.locator('.chronicles-party-bark__details');
      await barkTab.waitFor({ state: 'visible', timeout: 20000 });
      const delta = Number(await page.locator('body').getAttribute('data-earned-gold'));
      assert.ok(delta > 0);
      assert.equal(await barkTab.getAttribute('aria-expanded'), 'false');
      assert.equal(await barkDetails.isVisible(), false,
        'A narrative event must not cover the first-person scene before opt-in');
      await page.screenshot({ path: 'smoke-first-payment-' + width + '.png' });
      await barkTab.hover();
      await barkDetails.waitFor({ state: 'visible' });
      assert.ok((await barkDetails.innerText()).includes(delta + ' monedas de oro'),
        'Opt-in narration must show the actual earned gold');
      const bounds = await barkDetails.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
        'Hover narration must stay inside the viewport: ' + JSON.stringify(bounds));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: 'smoke-first-payment-hover-' + width + '.png' });

      // A real authored drop opens the real character equipment folio.
      await page.goto(url + '?view=loot', { waitUntil: 'domcontentloaded' });
      // A pointer left on the previous tab must not pre-open a new narration.
      await page.mouse.move(width - 6, 6);
      const lootCue = page.locator('.chronicles-party-bark');
      const lootTab = lootCue.locator('.chronicles-party-bark__trigger');
      await lootTab.waitFor({ state: 'visible', timeout: 20000 });
      const equipmentLink = page.getByRole('button', { name: 'Revisar equipo' });
      assert.equal(await equipmentLink.isVisible(), false,
        'The contextual CTA is hidden until the user opens the commentary');
      await page.screenshot({ path: 'smoke-first-loot-collapsed-' + width + '.png' });
      await lootTab.click();
      assert.equal(await lootTab.getAttribute('aria-expanded'), 'true');
      await equipmentLink.waitFor({ state: 'visible' });
      await page.screenshot({ path: 'smoke-first-loot-' + width + '.png' });
      await equipmentLink.click();
      const sheet = page.getByRole('dialog', { name: 'Matthias' });
      await sheet.waitFor({ state: 'visible' });
      assert.match(await sheet.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
        /Equipo/, 'Loot CTA must land directly in equipment');
      const skin = await sheet.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          backdropPosition: getComputedStyle(node.parentElement).position,
          scrollDisplay: getComputedStyle(node.querySelector('.chronicles-character-sheet__scroll')).display,
          contentDisplay: getComputedStyle(node.querySelector('.chronicles-character-sheet__folio-content')).display,
          menuLeft: node.querySelector('.chronicles-character-sheet__tabs').getBoundingClientRect().left,
          contentRight: node.querySelector('.chronicles-character-sheet__folio-content').getBoundingClientRect().right,
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        };
      });
      assert.equal(skin.backdropPosition, 'fixed',
        'The real game character-sheet overlay must be viewport-fixed');
      assert.equal(skin.scrollDisplay, 'block',
        'The folio scroll viewport remains a single bounded region');
      assert.equal(skin.contentDisplay, width <= 850 ? 'contents' : 'grid',
        'The real content keeps a flowing mobile page and two-column desktop dossier');
      if (width > 850) assert.ok(skin.menuLeft >= skin.contentRight - 2,
        'Desktop navigation must remain to the right of the content: ' + JSON.stringify(skin));
      assert.ok(skin.left >= -1 && skin.right <= width + 1,
        'Character sheet must fit horizontally: ' + JSON.stringify(skin));
      assert.ok(skin.top >= -1 && skin.bottom <= height + 1,
        'Character sheet must fit vertically: ' + JSON.stringify(skin));
      await page.screenshot({ path: 'smoke-first-loot-sheet-open-' + width + '.png' });
      // A sparse one-item bag must not reserve a tall, empty inventory well.
      // This measures real Chromium geometry before selecting or equipping.
      const inventoryGeometry = await sheet.locator('.chronicles-character-sheet__inventory')
        .evaluate((node) => {
          const box = node.getBoundingClientRect();
          const items = [...node.querySelectorAll('[data-inventory-item]')];
          return {
            height: box.height,
            count: items.length,
            firstRow: items[0]?.getBoundingClientRect().height || 0,
            overflowX: node.scrollWidth > node.clientWidth + 1,
          };
        });
      assert.equal(inventoryGeometry.count, 1, 'Loot fixture should exercise a single inventory row');
      assert.ok(inventoryGeometry.firstRow >= 44, 'Inventory controls stay touch-sized');
      assert.equal(inventoryGeometry.overflowX, false, 'Sparse inventory cannot overflow horizontally');
      if (width >= 851) {
        assert.ok(inventoryGeometry.height <= 90,
          'A single item should not reserve the old 180px storage well: ' + JSON.stringify(inventoryGeometry));
      }

      // A one-type bag does not need a filter or search disclosure. Real
      // search keyboard isolation remains covered with multiple items in
      // character-sheet-desktop, where filtering is useful.
      assert.equal(await sheet.locator('.chronicles-character-sheet__backpack-tools').count(), 0,
        'One-item bags must not waste another row on useless filter controls');
      if (width >= 851) {
        const sparseAlignment = await sheet.locator('.chronicles-character-sheet__backpack')
          .evaluate((node) => {
            const list = node.querySelector('.chronicles-character-sheet__inventory').getBoundingClientRect();
            const inspector = node.querySelector('.chronicles-character-sheet__item-details').getBoundingClientRect();
            return { listTop: list.top, inspectorTop: inspector.top,
              horizontal: list.right <= inspector.left + 2 };
          });
        assert.ok(Math.abs(sparseAlignment.listTop - sparseAlignment.inspectorTop) <= 16,
          'A sparse backpack must not leave an empty grid row above its inspector: '
            + JSON.stringify(sparseAlignment));
        assert.equal(sparseAlignment.horizontal, true,
          'The bag and item inspector must remain side by side');
      }
      await sheet.getByRole('button', { name: 'Espada de bronce', exact: true }).click();
      // This authored first-hour loot fixture uses the default legacy combat
      // rules; it exercises the real reward and Equipar, not MM3-only deltas.
      assert.equal(await sheet.locator('.chronicles-character-sheet__swap-preview').count(), 0,
        'Never invent MM3 weapon comparisons in a legacy-rules campaign');
      await sheet.getByRole('button', { name: 'Equipar Espada de bronce' }).click();
      // The compact summary must reflect the equip immediately without
      // forcing the player to open the detailed worn-gear cards.
      const equippedDetails = sheet.locator('.chronicles-character-sheet__equipped-disclosure');
      assert.equal(await equippedDetails.getAttribute('open'), null);
      assert.match(await equippedDetails.locator('summary').innerText(), /A: Espada de bronce/,
        'The real equip action must update the compact active melee weapon summary');
      await equippedDetails.locator('summary').click();
      const wornMeleeWeapon = equippedDetails.locator('.chronicles-character-sheet__gear-slot')
        .filter({ hasText: 'Arma · A' }).locator('strong');
      assert.match(await wornMeleeWeapon.innerText(), /Espada de bronce/,
        'Expanding details must still expose the real equipped melee weapon');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false, 'Loot equipment sheet must not cause horizontal overflow');
      await page.screenshot({ path: 'smoke-first-loot-equipped-' + width + '.png' });
      // Actual rendered sheet, not just the pure keyboard helper:
      // 4 switches Matthias → Faust without closing the equipment folio.
      await page.keyboard.press('4');
      const faustSheet = page.getByRole('dialog', { name: 'Faust' });
      await faustSheet.waitFor({ state: 'visible' });
      assert.match(await faustSheet.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
        /Equipo/, 'Party hotkey must retain the active equipment folio');
      assert.equal(await page.getByRole('dialog').count(), 1,
        'Switching character must not stack or duplicate modal sheets');

      // Switching back restores the same real equipped weapon and folio.
      await page.locator('.chronicles-character-sheet__tabs .is-active').focus();
      await page.keyboard.press('1');
      const restoredSheet = page.getByRole('dialog', { name: 'Matthias' });
      await restoredSheet.waitFor({ state: 'visible' });
      assert.match(await restoredSheet.locator('.chronicles-character-sheet__tabs .is-active').innerText(),
        /Equipo/, 'Returning to Matthias must keep equipment folio');
      const restoredGear = restoredSheet.locator('.chronicles-character-sheet__equipped-disclosure');
      assert.match(await restoredGear.locator('summary').innerText(), /A: Espada de bronce/,
        'Inspecting Faust must never equip/unequip Matthias');
      if (await restoredGear.getAttribute('open') === null) {
        await restoredGear.locator('summary').click();
      }
      assert.match(await restoredGear.locator('.chronicles-character-sheet__gear-slot')
        .filter({ hasText: 'Arma · A' }).locator('strong').innerText(), /Espada de bronce/,
        'Returning to Matthias must expose the actual equipped item after expanding details');

      // Regression: the real sheet must display the SAME hotkey numbering
      // even when a view adapter or initiative reverses party state.
      if (width === 390) {
        await page.goto(url + '?view=loot-reordered', { waitUntil: 'domcontentloaded' });
        const reorderedBark = page.locator('.chronicles-party-bark__trigger');
        await reorderedBark.waitFor({ state: 'visible' });
        await reorderedBark.click();
        await page.getByRole('button', { name: 'Revisar equipo' }).click();
        const reversedDock = page.locator('.chronicles-character-sheet__party-dock');
        await reversedDock.waitFor({ state: 'visible' });
        const slots = await reversedDock.locator('button').evaluateAll((buttons) => buttons.map((button) => ({
          slot: button.querySelector('.chronicles-character-sheet__party-number')?.textContent,
          name: button.querySelector('.chronicles-character-sheet__party-name')?.textContent,
        })));
        assert.deepEqual(slots, [
          { slot: '1', name: 'Matthias' },
          { slot: '2', name: 'Hildegard' },
          { slot: '3', name: 'Aziz' },
          { slot: '4', name: 'Faust' },
        ], 'Visible 1–4 numbers must match the actual hero keyboard bindings');
        await page.keyboard.press('4');
        await page.getByRole('dialog', { name: 'Faust' }).waitFor({ state: 'visible' });
      }

      // G's own dialog must consume the same 1–4 keys as the hero dock.
      // This is a real Quick Status → Character Sheet journey, not a mock row.
      if (width === 390 || width === 1280) {
        await page.goto(url + '?view=quick-status', { waitUntil: 'domcontentloaded' });
        const status = page.getByRole('dialog', { name: 'ESTADO DEL GRUPO' });
        await status.waitFor({ state: 'visible' });
        assert.match(await status.locator('footer').innerText(), /1–4/);
        await page.keyboard.press('Control+4');
        await page.keyboard.press('5');
        assert.equal(await status.count(), 1, 'Unsupported or modified keys leave G open');
        await page.keyboard.press('4');
        await status.waitFor({ state: 'hidden' });
        const faustStatusSheet = page.getByRole('dialog', { name: 'Faust' });
        await faustStatusSheet.waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('dialog').count(), 1,
          'G → 4 must display one dossier, not overlay a second modal');
        await page.keyboard.press('1');
        await page.getByRole('dialog', { name: 'Matthias' }).waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
        await page.locator('[data-reopen-quick-status]').click();
        await status.waitFor({ state: 'visible' });
        await page.keyboard.press('g');
        await status.waitFor({ state: 'hidden' });
      }

      // Real Crónica → hero dossier, not a keyboard-only helper.
      // Key modifiers must not open hidden world sheets or stack dialogs.
      if (width === 390 || width === 1280) {
        await gotoFixture(page, url + '?view=journal');
        const journal = page.getByRole('dialog', { name: 'Crónica de expedición' });
        await journal.waitFor({ state: 'visible' });
        assert.match(await journal.locator('footer').innerText(), /1–4/);
        await page.keyboard.press('Control+4');
        await page.keyboard.press('5');
        assert.equal(await journal.count(), 1, 'Modified/unassigned keys keep the journal open');
        await page.keyboard.press('4');
        await journal.waitFor({ state: 'hidden' });
        await page.getByRole('dialog', { name: 'Faust' }).waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('dialog').count(), 1,
          'J → 4 must close the journal before opening Faust');
        await page.keyboard.press('1');
        await page.getByRole('dialog', { name: 'Matthias' }).waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
        await page.locator('[data-reopen-journal]').click();
        await journal.waitFor({ state: 'visible' });
        await page.keyboard.press('j');
        await journal.waitFor({ state: 'hidden' });
      }

      // Real C/CAST → hero sheet, without stealing Aziz's combat turn.
      if (width === 390 || width === 1280) {
        await gotoFixture(page, url + '?view=spell-menu');
        const cast = page.getByRole('dialog', { name: 'Grimorio de magia' });
        await cast.waitFor({ state: 'visible' });
        assert.match(await cast.locator('footer').innerText(), /1–4/);
        await page.keyboard.press('Control+4');
        await page.keyboard.press('5');
        assert.equal(await cast.count(), 1);
        await page.keyboard.press('4');
        await cast.waitFor({ state: 'hidden' });
        await page.getByRole('dialog', { name: 'Faust' }).waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('dialog').count(), 1);
        assert.equal(await page.locator('[data-chronicles-cast-test-actor]').getAttribute('data-chronicles-cast-test-actor'), 'bishop');
        assert.equal(await page.locator('[data-chronicles-cast-test-actions]').getAttribute('data-chronicles-cast-test-actions'), '0');
        await page.keyboard.press('Escape');
        await page.locator('[data-reopen-cast]').click();
        await cast.waitFor({ state: 'visible' });
        assert.equal(await cast.getAttribute('data-chronicles-spell-menu'), 'bishop');
        await page.keyboard.press('Escape');
        await cast.waitFor({ state: 'hidden' });

        await gotoFixture(page, url + '?view=spell-menu-enemy');
        const enemyGrimoire = page.getByRole('dialog', { name: 'Grimorio de magia' });
        await enemyGrimoire.waitFor({ state: 'visible' });
        const spells = enemyGrimoire.locator('[data-chronicles-cast]');
        assert.ok(await spells.count() > 0);
        assert.equal(await spells.evaluateAll((nodes) => nodes.every((node) => node.disabled)), true);
        assert.match(await enemyGrimoire.locator('footer').innerText(), /turno de otro/);
        await page.keyboard.press('4');
        await page.getByRole('dialog', { name: 'Faust' }).waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-chronicles-cast-test-actions]').getAttribute('data-chronicles-cast-test-actions'), '0');
      }

      // The same C/I keys work *inside* the CAST folio, without leaking
      // keyboard actions into the hidden world.
      if (width === 390 || width === 1280) {
        await gotoFixture(page, url + '?view=spell-menu');
        const spellFolio = page.locator('[data-chronicles-spell-menu]');
        await spellFolio.waitFor({ state: 'visible' });
        assert.equal(await spellFolio.getAttribute('data-chronicles-menu-tab'), 'spells');
        await page.keyboard.press('i');
        assert.equal(await spellFolio.getAttribute('data-chronicles-menu-tab'), 'items');
        await page.getByRole('dialog', { name: 'Mochila de viaje' }).waitFor({ state: 'visible' });
        await page.keyboard.press('c');
        assert.equal(await spellFolio.getAttribute('data-chronicles-menu-tab'), 'spells');
        await page.getByRole('dialog', { name: 'Grimorio de magia' }).waitFor({ state: 'visible' });
        await page.keyboard.press('Control+i');
        assert.equal(await spellFolio.getAttribute('data-chronicles-menu-tab'), 'spells');
        await page.keyboard.press('c');
        await spellFolio.waitFor({ state: 'hidden' });
        await page.locator('[data-reopen-cast]').click();
        await spellFolio.waitFor({ state: 'visible' });
        await page.keyboard.press('i');
        await page.keyboard.press('i');
        await spellFolio.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('[data-chronicles-cast-test-actions]').getAttribute('data-chronicles-cast-test-actions'), '0',
          'Switching grimoire pages must never send a spell/item action');
      }

      // Real M/automap, including the Terra tab: numeric hotkeys must
      // inspect a hero and leave initiative/turn count untouched.
      if (width === 390 || width === 1280) {
        await gotoFixture(page, url + '?view=automap');
        const automap = page.getByRole('dialog', { name: 'Automapa de Chronicles' });
        await automap.waitFor({ state: 'visible' });
        assert.match(await automap.locator('footer').innerText(), /1–4/);
        await page.getByRole('tab', { name: 'Terra' }).click();
        await page.locator('[data-chronicles-worldmap="open"]').waitFor({ state: 'visible' });
        await page.keyboard.press('Control+4');
        await page.keyboard.press('5');
        assert.equal(await automap.count(), 1, 'Invalid/modified keys leave the map open');
        await page.keyboard.press('4');
        await automap.waitFor({ state: 'hidden' });
        await page.getByRole('dialog', { name: 'Faust' }).waitFor({ state: 'visible' });
        assert.equal(await page.getByRole('dialog').count(), 1, 'M→4 cannot stack modal sheets');
        assert.equal(await page.locator('[data-automap-actor]').getAttribute('data-automap-actor'), 'bishop');
        assert.equal(await page.locator('[data-automap-turns]').getAttribute('data-automap-turns'), '0');
        await page.keyboard.press('1');
        await page.getByRole('dialog', { name: 'Matthias' }).waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
        await page.locator('[data-reopen-automap]').click();
        await automap.waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Cerrar automapa' }).click();
        await automap.waitFor({ state: 'hidden' });
      }

      // Exercise the real production guide components as siblings while
      // React repeatedly alternates authored Swordhaven/road state and run IDs.
      // Duplicate keyed overlays once left three superposed, hit-testable hosts.
      // Keep guide assertions strict; retry only an aborted fixture navigation.
      await gotoFixture(page, url + '?view=guides');
      const allGuides = page.locator('[data-chronicles-first-steps], [data-chronicles-first-threat]');
      for (let step = 0; step < 8; step += 1) {
        const visibleGuide = step % 2 === 0
          ? page.locator('[data-chronicles-first-steps]')
          : page.locator('[data-chronicles-first-threat]');
        await visibleGuide.waitFor({ state: 'visible', timeout: 10_000 });
        assert.equal(await allGuides.count(), 1,
          'Exactly one React-owned Matthias guide after update ' + step + ' at ' + width + 'px');
        if (step === 3) await page.locator('[data-guide-new-run]').click();
        await page.locator('[data-guide-switch]').click();
      }
      assert.equal(await allGuides.count(), 1, 'No ghost guide after 8 scene transitions');
      await page.screenshot({ path: 'smoke-guide-reconciliation-' + width + '.png' });
      // Check the real computed ink/geometry, not a CSS source-text matcher.
      await gotoFixture(page, url + '?view=minimap-ink');
      const coord = page.locator('[data-chronicles-coordinates]');
      await coord.waitFor({ state: 'visible' });
      const position = await coord.evaluate((node) => {
        const parent = node.closest('[data-chronicles-minimap]');
        const svg = parent.querySelector('svg');
        const caption = node.getBoundingClientRect();
        const location = parent.querySelector('[data-chronicles-location]');
        const locationBounds = location.getBoundingClientRect();
        const frame = parent.getBoundingClientRect();
        const prefix = location.querySelector('.chronicles-minimap__location-prefix');
        const placeRange = document.createRange();
        placeRange.selectNodeContents(location.lastChild);
        const placeBounds = placeRange.getBoundingClientRect();
        return {
          color: getComputedStyle(node).color,
          shadow: getComputedStyle(node).textShadow,
          label: node.textContent.trim(),
          centered: Math.abs((caption.left + caption.right) / 2 -
            (frame.left + frame.right) / 2) <= 3,
          belowTiles: caption.top >= svg.getBoundingClientRect().bottom - 2,
          location: location.textContent.trim(),
          prefixDisplay: getComputedStyle(prefix).display,
          placeFits: placeBounds.left >= locationBounds.left - 1
            && placeBounds.right <= locationBounds.right + 1,
          locationClipped: location.scrollWidth > location.clientWidth + 1,
          locationColor: getComputedStyle(location).color,
          locationCentered: Math.abs((locationBounds.left + locationBounds.right) / 2 -
            (frame.left + frame.right) / 2) <= 3,
          locationBelowCoordinates: locationBounds.top >= caption.bottom - 2,
          locationWithinFrame: locationBounds.bottom <= frame.bottom + 1,
        };
      });
      const sandstone = width >= 1025 || (width >= 801 && height >= 601);
      assert.equal(position.color, sandstone ? 'rgb(36, 22, 13)' : 'rgb(226, 197, 151)',
        'Coords need dark ink on sandstone and pale ink on dark compact minimap: ' + JSON.stringify(position));
      if (sandstone) assert.equal(position.shadow, 'none', 'Dark coordinates must not have a light halo');
      assert.equal(position.locationColor, sandstone ? 'rgb(36, 22, 13)' : 'rgb(226, 197, 151)',
        'Location must contrast with the actual minimap backing: ' + JSON.stringify(position));
      assert.equal(position.location, 'UBICACIÓN · SWORDHAVEN');
      const compactMap = width <= 800 || (width <= 1024 && height <= 600);
      assert.equal(position.prefixDisplay === 'none', compactMap,
        'Only compact minimaps should omit the redundant visible prefix: ' + JSON.stringify(position));
      assert(position.placeFits && !position.locationClipped,
        'SWORDHAVEN must fit in the minimap caption without ellipsis: ' + JSON.stringify(position));
      assert(position.locationCentered && position.locationBelowCoordinates && position.locationWithinFrame,
        'Location should stay centered below coordinates within the minimap frame: ' + JSON.stringify(position));
      assert.match(position.label, /^X\d+ Y\d+$/);
      assert(position.centered && position.belowTiles,
        'Coordinates must remain centered below minimap tiles: ' + JSON.stringify(position));
      await page.screenshot({ path: 'smoke-minimap-ink-' + width + '.png' });
      await gotoFixture(page, url + '?view=minimap-poi');
      const serviceBadges = await page.locator('[data-chronicles-minimap]').evaluate((root) =>
        [...root.querySelectorAll('.chronicles-minimap__poi')].map((poi) => {
          const glyph = poi.querySelector('text');
          const shield = poi.querySelector('rect');
          const ink = glyph.getBBox();
          const plate = shield.getBBox();
          return {
            glyph: glyph.textContent,
            size: parseFloat(getComputedStyle(glyph).fontSize),
            fits: ink.width <= plate.width + .04 && ink.height <= plate.height + .04,
            foreground: getComputedStyle(glyph).fill,
            background: getComputedStyle(shield).fill,
          };
        }));
      assert.deepEqual(serviceBadges.map((badge) => badge.glyph).sort(), ['A', 'F'],
        'Only the two genuinely discovered local Swordhaven services may be visible');
      assert(serviceBadges.every((badge) => badge.size >= .8 && badge.fits
        && badge.foreground === 'rgb(255, 228, 171)'
        && badge.background === 'rgb(27, 24, 19)'),
      'Tiny service glyphs must be larger, high contrast and fit their shields: ' + JSON.stringify(serviceBadges));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
        'Service badges must not cause horizontal overflow');
      await page.screenshot({ path: 'smoke-minimap-poi-' + width + '.png' });
      assert.deepEqual(errors, [], 'No browser errors allowed');
      console.log('OK first-hour real sighting/payment/guide reconciliation ' + width + 'px');
    } catch (error) {
      failures.push(width + ': ' + error.message);
      console.error('FAIL first-hour visual smoke', width, error);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));