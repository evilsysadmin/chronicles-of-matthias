// CI-only component captures. No fake combat, seeded rewards or backend writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { gotoSmokeFixture } from './fixture-navigation.mjs';

const url = process.argv[2] || 'http://localhost:4174/smoke/first-hour-contact.html';
const browser = await chromium.launch();
const failures = [];
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
      await page.screenshot({ path: 'smoke-first-threat-' + width + '.png' });
      await page.getByRole('button', { name: 'Entendido' }).click();
      assert.equal(await cue.count(), 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await cue.count(), 0,
        'Dismissal must survive refresh for the same run');

      await page.goto(url + '?view=payment', { waitUntil: 'domcontentloaded' });
      const bark = page.locator('.chronicles-party-bark');
      await bark.waitFor({ state: 'visible', timeout: 20000 });
      // The real bark has a short opacity-in animation. Capturing at the first
      // DOM paint made desktop screenshots nearly invisible, unlike reduced-motion.
      await page.waitForFunction(() => {
        const node = document.querySelector('.chronicles-party-bark');
        return node && Number(getComputedStyle(node).opacity) > 0.95;
      }, null, { timeout: 5000 });
      const delta = Number(await page.locator('body').getAttribute('data-earned-gold'));
      assert.ok(delta > 0);
      assert.ok((await bark.innerText()).includes(delta + ' monedas de oro'),
        'Visible gold must equal real state delta');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false);
      await page.screenshot({ path: 'smoke-first-payment-' + width + '.png' });

      // A real authored drop opens the real character equipment folio.
      await page.goto(url + '?view=loot', { waitUntil: 'domcontentloaded' });
      const lootCue = page.locator('.chronicles-party-bark');
      await lootCue.waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForFunction(() => {
        const node = document.querySelector('.chronicles-party-bark');
        return node && Number(getComputedStyle(node).opacity) > 0.95;
      }, null, { timeout: 5000 });
      const equipmentLink = page.getByRole('button', { name: 'Revisar equipo' });
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
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        };
      });
      assert.equal(skin.backdropPosition, 'fixed',
        'The real game character-sheet overlay must be viewport-fixed');
      assert.equal(skin.scrollDisplay, width <= 850 ? 'block' : 'grid',
        'The real folio uses a single flowing column on mobile, two on desktop');
      assert.ok(skin.left >= -1 && skin.right <= width + 1,
        'Character sheet must fit horizontally: ' + JSON.stringify(skin));
      assert.ok(skin.top >= -1 && skin.bottom <= height + 1,
        'Character sheet must fit vertically: ' + JSON.stringify(skin));
      await page.screenshot({ path: 'smoke-first-loot-sheet-open-' + width + '.png' });
      // Numeric input receives digits while the loot is still in the backpack.
      // Equipping its only item correctly removes the search controls afterward.
      const backpackSearch = sheet.getByRole('searchbox', { name: 'Buscar en la mochila' });
      await backpackSearch.fill('');
      await backpackSearch.press('1');
      assert.equal(await backpackSearch.inputValue(), '1');
      assert.equal(await page.getByRole('dialog', { name: 'Matthias' }).count(), 1,
        'Typing 1 inside backpack search must not switch hero');
      await backpackSearch.fill('');
      await sheet.getByRole('button', { name: 'Espada de bronce', exact: true }).click();
      await sheet.getByRole('button', { name: 'Equipar Espada de bronce' }).click();
      // The MM3 double-weapon summary is optional in the test fixture; the
      // actual equipment-slot row is common to both character-sheet variants.
      const wornMeleeWeapon = sheet.locator('.chronicles-character-sheet__gear-slot')
        .filter({ hasText: 'Arma · A' }).locator('strong');
      assert.match(await wornMeleeWeapon.innerText(), /Espada de bronce/,
        'The real equip action must update the active melee weapon');
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
      assert.match(await restoredSheet.locator('.chronicles-character-sheet__gear-slot')
        .filter({ hasText: 'Arma · A' }).locator('strong').innerText(), /Espada de bronce/,
      'Inspecting Faust must never equip/unequip Matthias');

      // Regression: the real sheet must display the SAME hotkey numbering
      // even when a view adapter or initiative reverses party state.
      if (width === 390) {
        await page.goto(url + '?view=loot-reordered', { waitUntil: 'domcontentloaded' });
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

      // Exercise the real production guide components as siblings while
      // React repeatedly alternates authored Swordhaven/road state and run IDs.
      // Duplicate keyed overlays once left three superposed, hit-testable hosts.
      await gotoSmokeFixture(page, url + '?view=guides');
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
