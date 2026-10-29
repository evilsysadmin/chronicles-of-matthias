import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/party-avatar-interaction.html';
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: mobile, hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const hero = page.getByRole('button', { name: 'Seleccionar rook' });
      await hero.waitFor({ state: 'visible' });
      const selected = page.locator('[data-test-selection-count]');
      const opens = page.locator('[data-test-open-count]');
      const targets = page.locator('[data-test-target-count]');
      if (mobile) {
        await hero.tap();
        assert.equal(await hero.getAttribute('aria-pressed'), 'true', 'First tap selects');
        assert.equal(await opens.innerText(), '0', 'First tap does not open dossier');
        await hero.tap();
        await page.getByRole('dialog', { name: 'Ficha de rook' }).waitFor();
        assert.equal(await opens.innerText(), '1', 'Second fast tap opens just one dossier');
      } else {
        await hero.click();
        assert.equal(await hero.getAttribute('aria-pressed'), 'true', 'First click selects');
        assert.equal(await opens.innerText(), '0', 'Single click must not open dossier');
        await hero.dblclick();
        await page.getByRole('dialog', { name: 'Ficha de rook' }).waitFor();
        assert.equal(await opens.innerText(), '1', 'Double click opens once');
      }
      await page.getByRole('button', { name: 'Cerrar ficha' }).click();
      const faust = page.getByRole('button', { name: 'Seleccionar faust' });
      await faust.focus();
      await faust.press('Enter');
      await page.getByRole('dialog', { name: 'Ficha de faust' }).waitFor();
      assert.equal(await opens.innerText(), '2', 'Enter opens dossier from focused avatar');
      await page.getByRole('button', { name: 'Cerrar ficha' }).click();
      const matthias = page.getByRole('button', { name: 'Seleccionar matthias' });
      await matthias.focus();
      await matthias.press('Space');
      assert.equal(await matthias.getAttribute('aria-pressed'), 'true', 'Space selects instead of opening');

      await page.locator('[data-test-targeting]').click();
      await hero.dblclick();
      assert.equal(await targets.innerText(), '1', 'Rapid double click chooses spell target just once');
      assert.equal(await opens.innerText(), '2', 'A double click on spell target must never open dossier');
      assert.equal(await selected.innerText(), mobile ? '2' : '3',
        'Spell targeting does not silently select an unrelated hero');
      assert.deepEqual(errors, [], 'No errors during avatar interactions');
      console.log('CHRONICLES_AVATAR_INTERACTION_OK', mobile ? 'touch' : 'mouse');
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
