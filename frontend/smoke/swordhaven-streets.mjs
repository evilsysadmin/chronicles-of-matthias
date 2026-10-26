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
    for (const view of ['oldtown', 'apothecary', 'guild', 'forge', 'armor', 'temple', 'store', 'tavern', 'watch', 'alley', 'ward', 'roofline']) {
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
        // The old combined 126 blockers are now split between interior
        // street walls and the independent 80-cell fortified town perimeter.
        assert.equal(Number(result.wallCount), 126);
        assert.equal(Number(result.perimeterCount), 80);
        assert.equal(result.perimeterUnculled, 'true',
          'The town enclosure must not vanish under camera frustum culling');
        assert.ok(Number(result.roadCount) > 100);
        assert.equal(Number(result.plasterCount), 94);
        assert.equal(result.windowDetail, 'true',
          'Rendered street windows must have merged mullions and sills inside solid cells');
        assert.equal(result.plasterRelief, 'true',
          'Real street facades must use aligned, shared limewash relief');
        assert.equal(Number(result.roofCount), 7);
        assert.equal(result.distinctShopFacades, 'true',
          'Apothecary and guild must have distinct authored silhouettes');
        assert.equal(result.distinctTemplePortico, 'true',
          'Temple must have its own colonnaded stone entrance');
        assert.equal(result.distinctMetalworkFacades, 'true',
          'Forge and armorer must have distinct authored rooflines');
        assert.equal(result.distinctWatchhouse, 'true',
          'Guardhouse must have a raised crenellated lookout distinct from the armorer');
        assert.equal(result.distinctTavernRoof, 'true',
          'Tavern must have a unique two-flue brick hearth roofline');
        assert.equal(result.distinctMarketStore, 'true',
          'Quartermaster store must have a unique overhead striped awning');
        assert.equal(result.roofRelief, 'true',
          'Real street roofs must use aligned, shared shingle relief');
        // 188 facade posts + 38 reinforced corners + 92 diagonal braces
        // on the 46 windowless faces, still in the same instanced batch.
        assert.equal(Number(result.cornerUprights), 318);
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
