import { test, expect } from '@playwright/test';

test('original MM3 texture atlas and pixel font really render in landscape WebGL', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const broken = [];
  page.on('response', response => {
    if (response.status() >= 400 && /\.(png|woff2)(?:\?|$)/.test(response.url())) {
      broken.push(response.url());
    }
  });
  await page.goto('/react/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Nueva campaña/ }).click();
  await expect(page.locator('.react-swordhaven-canvas')).toBeVisible();
  await expect(page.locator('.react-town-party-member')).toHaveCount(4);
  const actual = await page.evaluate(async () => {
    await document.fonts.load('20px "Chronicles Pixel"');
    await document.fonts.ready;
    const css = selector => getComputedStyle(document.querySelector(selector));
    return {
      controls: css('.react-town-controls button').backgroundImage,
      menu: css('.react-town-menu-button').backgroundImage,
      minimap: css('.react-town-map-panel').backgroundImage,
      frame: css('.react-town-frame').borderImageSource,
      portraits: css('.react-town-party-member').backgroundImage,
      fontFamily: css('.react-town-party-member span').fontFamily,
      fontLoaded: document.fonts.check('20px "Chronicles Pixel"'),
      isWebGL: Boolean(document.querySelector('.react-swordhaven-canvas')),
      stageWidth: document.querySelector('.react-town-frame').getBoundingClientRect().width,
    };
  });
  for (const property of ['controls','menu','minimap','frame','portraits']) {
    expect(actual[property], property + ' must use real extracted original MM3 texture').toContain('url(');
  }
  expect(actual.fontFamily).toContain('Chronicles Pixel');
  expect(actual.fontLoaded).toBe(true);
  expect(actual.isWebGL).toBe(true);
  expect(actual.stageWidth).toBeGreaterThan(700);
  expect(broken).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('swordhaven-vga-landscape.png'), fullPage: false });
});
