import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });

test('portrait Android gameplay requests fullscreen + landscape from Play gesture and recovers on exit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const calls = [];
    window.__landscapeCalls = calls;
    let fullElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      get: () => fullElement, configurable: true,
    });
    Element.prototype.requestFullscreen = async function () {
      calls.push('fullscreen');
      fullElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      calls.push('exit');
      fullElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    Object.defineProperty(screen, 'orientation', {
      value: {
        lock: async value => { calls.push('lock:' + value); },
        unlock: () => calls.push('unlock'),
      }, configurable: true,
    });
  });
  await page.goto('/react/', { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => window.__landscapeCalls)).toEqual([]); // no fake load-time lock
  await page.getByRole('button', { name: 'Recorrer Swordhaven original en 3D' }).click();
  await expect.poll(() => page.evaluate(() => window.__landscapeCalls.slice(0, 2)))
    .toEqual(['fullscreen', 'lock:landscape']);
  await expect(page.getByRole('dialog', { name: 'Chronicles se juega en apaisado' })).toBeVisible();
  await page.getByRole('button', { name: 'Activar apaisado' }).click();
  await expect.poll(() => page.evaluate(() => window.__landscapeCalls.filter(call => call.startsWith('lock:')).length)).toBe(2);
  await page.setViewportSize({ width: 844, height: 390 }); // emulates OS rotation
  await expect(page.getByRole('dialog', { name: 'Chronicles se juega en apaisado' })).toHaveCount(0);
  await expect(page.locator('.react-swordhaven-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú de Swordhaven' }).click();
  await page.getByRole('button', { name: 'Salir al inicio' }).click();
  await expect(page.getByRole('button', { name: 'Recorrer Swordhaven original en 3D' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__landscapeCalls.slice(-2)))
    .toEqual(['unlock', 'exit']);
});

test('portrait phone with rejected orientation lock shows manual rotation hint but stays playable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(screen, 'orientation', {
      value: {
        lock: async () => { throw new Error('orientation denied'); },
        unlock: () => {},
      }, configurable: true,
    });
    Element.prototype.requestFullscreen = async () => {
      throw new Error('fullscreen denied');
    };
  });
  await page.goto('/react/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Recorrer Swordhaven original en 3D' }).click();
  await expect(page.getByRole('dialog', { name: 'Chronicles se juega en apaisado' })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('dialog', { name: 'Chronicles se juega en apaisado' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Avanzar' }).click();
  await expect(page.locator('.react-town-status')).toContainText('Y15');
});
