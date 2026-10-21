import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Real menu component. A synthetic catalog STATUS is only a presentation
// fixture; no calls to backend or invented checkpoint/save payloads.
const base = process.argv[2] || 'http://localhost:4174/smoke/save-menu.html';
const browser = await chromium.launch();
const failures = [];
try {
  for (const width of [360, 390, 430, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 800 : 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + '?status=error&count=1', { waitUntil: 'domcontentloaded' });
      await page.getByText('No se pudo consultar el servidor.').waitFor();
      await page.getByText('Otras opciones').click();
      await page.getByRole('button', { name: 'Gestionar partidas' }).click();
      await page.getByText('La torre del este').waitFor();
      for (const action of ['Cargar', 'Renombrar', 'Quitar']) {
        assert.equal(await page.getByRole('button', { name: action, exact: true }).isDisabled(), true,
          action + ' must be unavailable during an unresolved catalog');
      }
      assert.equal(await page.getByText(/Se muestra el índice local:/).count(), 1);
      await page.screenshot({ path: 'smoke-save-catalog-' + width + '.png' });
      await page.getByRole('button', { name: 'Reintentar sincronización' }).click();
      await page.getByText('La torre del este').waitFor();
      for (const action of ['Cargar', 'Renombrar', 'Quitar']) {
        assert.equal(await page.getByRole('button', { name: action, exact: true }).isEnabled(), true,
          action + ' must recover after successful retry');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);

      // A failed remote query must never be represented as a confirmed empty account.
      await page.goto(base + '?status=error&count=0', { waitUntil: 'domcontentloaded' });
      await page.getByText('Otras opciones').click();
      await page.getByRole('button', { name: 'Gestionar partidas' }).click();
      assert.equal(await page.getByText(/No se pudo comprobar si hay partidas en el servidor/).count(), 1);
      assert.equal(await page.getByText('Todavía no hay expediciones guardadas.').count(), 0);
      console.log('OK save catalog recovery ' + width);
    } catch (error) {
      failures.push(width + ': ' + error.message);
      console.error('FAIL save menu', width, error);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
