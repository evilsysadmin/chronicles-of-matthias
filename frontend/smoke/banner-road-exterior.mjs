// Reproducible first-person captures of the *actual* Banner Road renderer.
// No mocked foliage, backend account, movement teleport or staging credentials.
// Each PR artifact provides a comparable eye-level forest frame for visual review.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/banner-road-exterior.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [width, height, coarse] of [
    [390, 844, true],
    [1280, 800, false],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url + '?coarse=' + (coarse ? '1' : '0'),
        { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        document.body.dataset.sceneReady === 'true'
          || Boolean(document.body.dataset.sceneError),
      null, { timeout: 30000 });
      const state = await page.evaluate(() => ({
        ...document.body.dataset,
        canvasWidth: document.querySelector('#stage')?.width,
        canvasHeight: document.querySelector('#stage')?.height,
        viewportOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      // Always keep the real frame, including on assertion failure.
      const filename = 'smoke-banner-road-first-person-' + width + '.png';
      await page.screenshot({ path: filename });
      assert.equal(state.sceneError, undefined, JSON.stringify(state));
      assert.deepEqual(errors, [], 'No JavaScript errors during real Banner Road WebGL rendering');
      assert.equal(state.sceneReady, 'true');
      assert.equal(state.mapId, 'banner-road-first-book');
      assert.equal(state.cameraCell, '10,13');
      assert.equal(state.coarsePointer, String(coarse));
      assert.equal(state.viewportOverflow, false);
      assert.equal(state.canvasWidth, width);
      assert.equal(state.canvasHeight, height);
      assert.ok(Number(state.roadCount) > 20, 'Real paved trail must be present');
      assert.ok(Number(state.crownCount) > 10, 'Real broadleaf trees must be visible');
      assert.ok(Number(state.bushCount) > 5, 'Roadside bushes must be present');
      assert.ok(Number(state.canopyTints) > 1, 'Tree instances must not all share one tint');
      assert.equal(Number(state.canopyTriangles), coarse ? 60 : 400,
        'Keep the real mobile/desktop layered foliage geometry budget');
      assert.ok(Number(state.canopyVertexColors) > 0,
        'Crown gradient must be available in the actual WebGL mesh');
      assert.ok(Number(state.canopyShadeRange) > 0.15,
        'Crown needs visible top/bottom and lobe-to-lobe colour variation');
      assert.ok(Number(state.canopyTopShade) > Number(state.canopyBottomShade),
        'Sunlit upper crown must remain brighter than the underside');
      assert.equal(state.groundKind, 'meadow');
      assert.equal(Number(state.groundAtlasSize), 128);
      assert.equal(Number(state.groundRepeat), 7);
      assert.equal(Number(state.groundCount), 1);
      assert.equal(state.roadRelief, String(!coarse),
        'Mobile uses cheaper paving without normal maps');
      assert.ok(Number(state.fogNear) > 10 && Number(state.fogFar) > Number(state.fogNear),
        'The actual scene must have atmospheric depth, not a flat clear horizon');
      assert.ok(Number(state.pixelVariants) > 10,
        'Rendered scene must contain varied pixels, not an empty canvas');
      assert.ok((await stat(filename)).size > 20000,
        'Actual first-person screenshot must not be empty');
      console.log('CHRONICLES_BANNER_ROAD_POV_OK width=' + width
        + ' eye=10,13 canopy=' + state.crownCount
        + ' fog=' + state.fogNear + '..' + state.fogFar
        + ' variants=' + state.pixelVariants + ' file=' + filename);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
