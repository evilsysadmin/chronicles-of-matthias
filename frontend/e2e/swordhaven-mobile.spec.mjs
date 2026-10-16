import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 360, height: 740, name: 'phone-360' },
  { width: 390, height: 844, name: 'phone-390' },
  { width: 430, height: 932, name: 'phone-430' },
  { width: 844, height: 390, name: 'landscape-844' },
];

for (const viewport of VIEWPORTS) {
  test('Swordhaven 3D immersive layout: ' + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/react/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nueva campaña/ }).click();

    const frame = page.locator('.react-town-frame');
    const canvas = page.locator('.react-swordhaven-canvas');
    const controls = page.locator('.react-town-controls');
    const party = page.locator('.react-town-party');

    await expect(canvas).toBeVisible();
    await expect(page.locator('.react-swordhaven-error')).toHaveCount(0);
    await expect(frame).toBeVisible();
    await expect(controls).toBeVisible();
    await expect(party.locator('.react-town-party-member')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Avanzar' })).toBeVisible();
    await expect(page.locator('.react-town-objective')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menú de Swordhaven' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Crónica/ })).toBeVisible();
    if (viewport.height < viewport.width) {
      await expect(page.locator('.react-town-minimap')).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Mostrar mapa' }).click();
      await expect(page.locator('.react-town-minimap')).toBeVisible();
      await page.getByRole('button', { name: 'Ocultar mapa' }).click();
    }


    const metrics = await page.evaluate(() => {
      const rect = selector => {
        const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height, bottom, right };
      };
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        frame: rect('.react-town-frame'),
        canvas: rect('.react-swordhaven-canvas'),
        controls: rect('.react-town-controls'),
        party: rect('.react-town-party'),
        hud: rect('.react-town-hud'),
        objective: rect('.react-town-objective'),
        minimap: rect('.react-town-map-panel'),

      };
    });

    expect(metrics.documentWidth, 'no horizontal page overflow').toBeLessThanOrEqual(metrics.innerWidth + 1);
    expect(metrics.documentHeight, 'no vertical scrolling in the game screen').toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.frame.height, '3D scene must remain the visual focus').toBeGreaterThan(
      viewport.height < 500 ? 140 : viewport.height * 0.35
    );
    expect(metrics.canvas.width).toBeGreaterThan(180);
    expect(metrics.frame.height, '3D canvas should occupy almost the entire game window')
      .toBeGreaterThan(metrics.innerHeight * 0.91);
    expect(metrics.party.y, 'portraits must float above the game rather than below it')
      .toBeLessThan(metrics.innerHeight * 0.30);
    expect(metrics.controls.y, 'controls must live in the lower game HUD')
      .toBeGreaterThan(metrics.innerHeight * 0.50);

    expect(metrics.party.bottom, 'four party portraits visible without scrolling').toBeLessThanOrEqual(viewport.height + 2);
    expect(metrics.controls.bottom, 'all movement controls visible').toBeLessThanOrEqual(viewport.height + 2);

    await page.screenshot({ path: testInfo.outputPath(viewport.name + '.png'), fullPage: false });
    await page.getByRole('button', { name: 'Avanzar' }).click();
    await expect(page.locator('.react-town-status')).toContainText('Y15');
    await page.getByRole('button', { name: 'Reiniciar recorrido en Swordhaven' }).click();
    await expect(page.locator('.react-town-status')).toContainText('Y16');
    await page.getByRole('button', { name: 'Abrir menú de Swordhaven' }).click();
    await expect(page.getByRole('dialog', { name: 'Menú de Swordhaven' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar exploración' }).click();
    await page.getByRole('button', { name: /Crónica/ }).click();
    await expect(page.getByRole('dialog', { name: 'Crónica de expedición' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar Crónica' }).click();

  });
}
