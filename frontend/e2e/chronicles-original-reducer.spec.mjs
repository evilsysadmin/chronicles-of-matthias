import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844, label: 'portrait' },
  { width: 844, height: 390, label: 'landscape' },
]) {
  test('the original MM3 reducer really bootstraps Swordhaven: ' + viewport.label, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/react/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nueva campaña/ }).click();
    await expect(page.locator('.react-swordhaven-canvas')).toBeVisible();

    const canonical = page.locator('[data-chronicles-initial-mm3="true"]');
    await expect(canonical).toHaveAttribute('data-chronicles-map-id', 'swordhaven-square');
    await expect(canonical).toHaveAttribute('data-chronicles-phase', 'explore');
    const heroes = canonical.locator('.react-town-party-member');
    await expect(heroes).toHaveCount(4);
    for (const name of ['Matthias', 'Hildegard', 'Aziz', 'Faust']) {
      await expect(canonical.getByText(name, { exact: true })).toBeVisible();
    }
    const health = await canonical.locator('.react-town-party-vitals').allTextContents();
    expect(health.length).toBe(4);
    for (const status of health) expect(status).toMatch(/\b\d+\/\d+ PV\b/);

    const initial = await page.locator('.react-town-status').textContent();
    await page.getByRole('button', { name: 'Avanzar' }).click();
    await expect(page.locator('.react-town-status')).not.toHaveText(initial);
    await expect(canonical).toHaveAttribute('data-chronicles-map-id', 'swordhaven-square');
    await expect(canonical.locator('.react-town-party-vitals')).toHaveCount(4);
    expect(errors).toEqual([]);
  });
}
