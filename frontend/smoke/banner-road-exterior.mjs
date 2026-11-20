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
      assert.ok(Number(state.nearRoadsideBushes) > (coarse ? 1 : 4),
        'First-person Banner Road must show non-blocking shrubs in the actual verge grass');
      assert.ok(Number(state.nearRoadsideHerbs) > (coarse ? 0 : 3),
        'First-person woodland undergrowth must bridge the gap between track and trees');
      assert.ok(Number(state.grassCount) > 20, 'Short turf must remain visible');
      assert.ok(Number(state.sedgeCount) > 15, 'Distinct broad-leaved sedges must render');
      assert.ok(Number(state.herbCount) > (coarse ? 20 : 40),
        'Forest-edge leafy plants must fill the missing mid/low vegetation layer');
      assert.equal(Number(state.herbTriangles), coarse ? 8 : 28,
        'One low-poly shared undergrowth geometry per forest scene');
      assert.ok(Number(state.juvenileTrees) > 5,
        'Some existing tall tree instances must be replaced with younger trees');
      assert.equal(Number(state.woodlandGatewayTrees), 2,
        'Actual Banner Road must frame its road with two mature trees on blocked forest cells');
      assert.ok(Number(state.woodlandGatewayMinTrunkHeight) > 4.5,
        'Gateway trunks must be mature rather than tiny distant saplings');
      assert.ok(Number(state.woodlandGatewayLowestLeaf) > 2.35,
        'Overhanging canopy must clear the player, never form a low foliage wall');
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
      assert.ok(Number(state.skyCloudOpacity) > 0.60,
        'The clear-day panorama must have meaningful weather-controlled opacity');
      assert.ok(Number(state.skyCloudPixelDifference) > 1.2,
        'The actual WebGL sky must visibly change when real clouds are drawn');
      assert.equal(Number(state.cloudBankCount), coarse ? 4 : 8,
        'Banner Road must create a bounded set of real cloud sprites, not just a distant panorama');
      assert.ok(Number(state.cloudBankOpacity) > 0.53,
        'Real Banner Road clear-day cloud sprites must be visibly lit');
      assert.ok(Number(state.cloudBankPixelDifference) > 0.6,
        'Real upper-sky framebuffer must change when nearby cloud banks are hidden');
      assert.ok(Number(state.skyCloudSampleMinute) > 0,
        'Capture a deterministic clear-day period rather than a random overcast seed');
      assert.equal(Number(state.groundAtlasSize), 128);
      assert.equal(Number(state.groundRepeat), 7);
      assert.equal(Number(state.groundCount), 1);
      assert.equal(state.roadSurfaceKind, 'woodlandpath',
        'The genuine Banner Road must render its packed-earth trail, not Swordhaven cobbles');
      assert.equal(Number(state.roadSurfaceAtlasSize), 128,
        'Earth and grit must share a bounded local 128px texture atlas');
      assert.equal(state.roadRelief, 'false',
        'Never keep stone-cobble normal relief on a natural dirt track');
      assert.ok(Number(state.edgeFringeInstances) > 25,
        'Real woodland track must retain its single batched verge along both sides');
      assert.equal(Number(state.edgeFringeCount), coarse ? 4 : 8,
        'Real 390px and 1280px track must expose irregular top-level moss tongues');
      assert.ok(Number(state.edgeFringeMaxIntrusion) > 0.14
        && Number(state.edgeFringeMaxIntrusion) < 0.27,
        'Overlapping moss must soften the edge without swallowing the usable track');
      assert.ok(Number(state.fogNear) > 10 && Number(state.fogFar) > Number(state.fogNear),
        'The actual scene must have atmospheric depth, not a flat clear horizon');
      assert.ok(Number(state.pixelVariants) > 10,
        'Rendered scene must contain varied pixels, not an empty canvas');
      assert.ok((await stat(filename)).size > 20000,
        'Actual first-person screenshot must not be empty');
      console.log('CHRONICLES_BANNER_ROAD_SKY_PIXEL_DIFF width=' + width
        + ' difference=' + state.skyCloudPixelDifference
        + ' opacity=' + state.skyCloudOpacity
        + ' worldMinute=' + state.skyCloudSampleMinute
        + ' bankCount=' + state.cloudBankCount
        + ' bankDifference=' + state.cloudBankPixelDifference);
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
