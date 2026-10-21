// CI-only interaction smoke for the REAL editor (no test-only production route).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/character-setup.html';
const browser = await chromium.launch();
let failures = [];
try {
  for (const width of [360, 390, 430, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 800 : 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-chronicles-character-setup="choice"]').waitFor();
      await page.getByRole('button', { name: 'Crear mis personajes' }).click();
      await page.locator('[data-chronicles-character-setup="editor"]').waitFor();

      const firstName = 'Matthias el audaz';
      const secondName = 'Aziz el sabio';
      await page.getByRole('textbox', { name: /Nombre del héroe 1:/ }).fill(firstName);
      await page.getByRole('button', { name: /Héroe 2 de 4:/ }).click();
      await page.getByRole('textbox', { name: /Nombre del héroe 2:/ }).fill(secondName);
      await page.getByRole('button', { name: '← Volver', exact: true }).click();

      const choice = page.locator('[data-chronicles-character-setup="choice"]');
      await choice.waitFor();
      assert.equal(await page.getByTestId('chronicles-character-draft-kept').count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Continuar edición' }).count(), 1);
      assert.equal(await page.locator('.chronicles-character-setup__choice-main-actions .primary-btn').innerText(),
        'Continuar edición', 'Resume must be the primary action with an unfinished draft');
      assert.equal(await page.getByRole('button', { name: 'Empezar con el grupo preparado' }).count(), 1);
      assert.equal(await page.getByRole('button', { name: '← Salir y descartar borrador' }).count(), 1);
      await page.screenshot({ path: 'smoke-character-return-' + width + '.png' });

      await page.getByRole('button', { name: 'Continuar edición' }).click();
      const resumed = page.locator('[data-chronicles-character-setup="editor"]');
      await resumed.waitFor();
      assert.equal(await page.getByRole('textbox', { name: /Nombre del héroe 2:/ }).inputValue(), secondName);
      await page.getByRole('button', { name: /Héroe 1 de 4:/ }).click();
      assert.equal(await page.getByRole('textbox', { name: /Nombre del héroe 1:/ }).inputValue(), firstName);

      if (width === 390) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await resumed.waitFor();
        assert.equal(await page.getByRole('textbox', { name: /Nombre del héroe 1:/ }).inputValue(), firstName);
        await page.getByRole('button', { name: /Héroe 2 de 4:/ }).click();
        assert.equal(await page.getByRole('textbox', { name: /Nombre del héroe 2:/ }).inputValue(), secondName);
        await page.getByRole('button', { name: 'Confirmar compañía' }).click();
        await page.waitForFunction(() => document.body.dataset.confirmedParty?.includes('Aziz el sabio'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await choice.waitFor();
        assert.equal(await page.getByTestId('chronicles-character-draft-kept').count(), 0,
          'Confirmed party must clear draft');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, 'Editor overflows horizontally at ' + width + 'px');
      assert.deepEqual(errors, [], 'Unexpected browser errors');
      console.log('OK   Character edit/back/resume: ' + width + 'px');
    } catch (err) {
      failures.push(width + 'px: ' + err.message);
      console.error('FAIL Character editor:', width, err);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
