// Real Three.js Swordhaven render snapshots for PR review.
// No mocked 3D artwork, gameplay bypass or staging credentials.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/swordhaven-streets.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const failures = [];
try {
  for (const width of [390, 1280]) {
    for (const view of ['oldtown', 'alley', 'ward', 'roofline']) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1280 ? 800 : 844 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      try {
        await page.goto(url + '?view=' + view, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() =>
          document.body.dataset.sceneReady === 'true'
          || Boolean(document.body.dataset.sceneError),
        null, { timeout: 30_000 });
        const result = await page.evaluate(() => ({
          ...document.body.dataset,
          canvasWidth: document.querySelector('#stage')?.width,
          canvasHeight: document.querySelector('#stage')?.height,
          overflowing: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        // Save evidence even when the contract fails, so review has a frame.
        await page.screenshot({ path: 'smoke-swordhaven-' + view + '-' + width + '.png' });
        assert.equal(result.sceneError, undefined, JSON.stringify(result));
        assert.equal(result.sceneReady, 'true');
        assert.equal(result.mapId, 'swordhaven-first-book');
        assert.equal(result.streetView, view);
        assert.equal(Number(result.wallHeight), 6.4,
          'Street view must not regress to 1.6m parapet');
        assert.ok(Number(result.wallCount) > 50);
        assert.ok(Number(result.roadCount) > 100);
        assert.equal(Number(result.plasterCount), 94);
        assert.equal(result.windowDetail, 'true',
          'Rendered street windows must have merged mullions and sills inside solid cells');
        assert.equal(result.plasterRelief, 'true',
          'Real street facades must use aligned, shared limewash relief');
        assert.equal(Number(result.roofCount), 7);
        assert.equal(result.roofRelief, 'true',
          'Real street roofs must use aligned, shared shingle relief');
        assert.equal(Number(result.cornerUprights), 226);
        // A close masonry facade at phone width may occupy almost the entire
        // frame with just a few colours. Only reject a truly flat framebuffer.
        assert.ok(Number(result.pixelVariants) >= 2,
          'Blank WebGL framebuffer: ' + JSON.stringify(result));
        assert.equal(result.canvasWidth, width);
        assert.equal(result.canvasHeight, width === 1280 ? 800 : 844);
        assert.equal(result.overflowing, false);
        assert.deepEqual(pageErrors, []);
        console.log('OK real Swordhaven 3D ' + view + ' ' + width + 'px');
      } catch (error) {
        failures.push(view + '/' + width + ': ' + error.message);
        console.error('FAIL Swordhaven 3D smoke', view, width, error);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
