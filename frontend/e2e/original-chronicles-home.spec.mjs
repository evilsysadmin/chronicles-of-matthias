import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844, name: 'portrait' },
  { width: 1024, height: 700, name: 'desktop' },
]) {
  test('original expedition Home art and real actions: ' + viewport.name, async ({ page }, info) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/react/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Chronicles/ })).toBeVisible();
    const home = page.locator('.chronicles-save-menu--expedition');
    await expect(home).toBeVisible();
    await expect(home.getByRole('button', { name: /Nueva campaña/ })).toBeEnabled();
    await expect(home.getByRole('button', { name: /Nuevo juego/ })).toBeEnabled();
    await expect(home.getByRole('button', { name: /Continuar partida/ })).toBeDisabled();
    await expect(home.getByRole('button', { name: /Cargar juego/ })).toBeDisabled();
    await expect(home.getByRole('button', { name: /Gestionar partidas/ })).toBeEnabled();
    const art = await page.locator('.chronicles-save-menu__sky').evaluate(el =>
      getComputedStyle(el).backgroundImage
    );
    expect(art).toContain('expedition-study');
    await page.screenshot({ path: info.outputPath('chronicles-original-library-' + viewport.name + '.png') });
    await home.getByRole('button', { name: /Gestionar partidas/ }).click();
    await expect(page.getByText('Todavía no hay expediciones guardadas.')).toBeVisible();
    await home.getByRole('button', { name: /Volver/ }).click();
    await home.getByRole('button', { name: /Nueva campaña/ }).click();
    await expect(page.locator('.react-swordhaven-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir menú de Swordhaven' })).toBeVisible();
    const gem = await page.locator('.react-town-menu-button').evaluate(el =>
      getComputedStyle(el).backgroundImage
    );
    expect(gem).toContain('mm3-sapphire');
  });
}
