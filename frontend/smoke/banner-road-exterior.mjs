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
      assert.ok(Math.abs(Number(state.roadApproachWidth) - 2.64) < 0.001,
        'Actual eye-level Banner Road must have a 2.64m cart trail on desktop and mobile');
      assert.ok(Number(state.crownCount) > 10, 'Real broadleaf trees must be visible');
      assert.ok(Number(state.bushCount) > 5, 'Roadside bushes must be present');
      assert.ok(Number(state.grassCount) > 20, 'Short turf must remain visible');
      assert.ok(Number(state.sedgeCount) > 15, 'Distinct broad-leaved sedges must render');
      assert.ok(Number(state.herbCount) > (coarse ? 20 : 40),
        'Forest-edge leafy plants must fill the missing mid/low vegetation layer');
      assert.equal(Number(state.herbTriangles), coarse ? 8 : 28,
        'One low-poly shared undergrowth geometry per forest scene');
      assert.ok(Number(state.juvenileTrees) > 5,
        'Some existing tall tree instances must be replaced with younger trees');
      assert.ok(Number(state.paleTrunks) > 12,
        'Real forest must mix pale narrow trees among mature broadleaf trees');
      assert.ok(Number(state.forestRingTrees) > (coarse ? 120 : 225),
        'Tree-filled horizon must remain dense across mobile and desktop');
      assert.ok(Number(state.forestDeepRingTrees) > (coarse ? 50 : 90),
        'The distant third ring must interlock crowns without changing the walkable map');
      assert.ok(Number(state.sedgeCount) < Number(state.grassCount),
        'Sedges must break up, not replace, the darker turf');
      assert.equal(Number(state.sedgeTriangles), coarse ? 8 : 16,
        'Keep the second species within a fixed small mobile/desktop budget');
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
      assert.ok(Number(state.meadowSoilFraction) > 0.04
        && Number(state.meadowSoilFraction) < 0.07,
      'Actual first-person meadow texture should have fine, restrained earth patches');
      assert.ok(Math.abs(Number(state.cameraPitch)) < 0.0001,
        'Visual QA must use the same level camera as live MM3 gameplay');
      assert.equal(Number(state.skyCloudAtlasWidth), coarse ? 256 : 512,
        'Keep the existing low-cost mobile/desktop 360-degree cloud atlas');
      assert.ok(Number(state.skyCloudOpacity) > 0.14,
        'The actual daylight scene must display its weather-controlled cloud panorama');
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
