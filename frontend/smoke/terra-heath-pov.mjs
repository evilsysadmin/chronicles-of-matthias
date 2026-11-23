// Terra v67: a second, genuinely playable sightline for reusable B2 heath tiles.
// The historical ruin camera points WEST; this one walks four passable cells
// from B2 spawn into off-road foothills, looking SOUTH at native heath.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/terra-landscape-pov.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const captures = [];
  for (const [width, height, coarse] of [[390, 844, true], [1280, 800, false]]) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const filename = 'smoke-terra-landscape-terra-b2-' + width + '-heath.png';
    try {
      await page.goto(url + '?map=terra-b2&view=heath&coarse=' + (coarse ? '1' : '0'),
        { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.dataset.sceneReady === 'true'
        || Boolean(document.body.dataset.sceneError), null, { timeout: 30000 });
      const state = await page.evaluate(() => ({
        ...document.body.dataset,
        canvasWidth: document.querySelector('#stage')?.width,
        canvasHeight: document.querySelector('#stage')?.height,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      // Always keep the REAL framebuffer for diagnosis, even if an assertion fails.
      await page.screenshot({ path: filename });
      assert.equal(state.sceneError, undefined, JSON.stringify(state));
      assert.deepEqual(errors, [], 'No real B2 WebGL rendering errors');
      assert.equal(state.sceneReady, 'true');
      assert.equal(state.view, 'heath');
      assert.equal(state.mapId, 'terra-b2');
      assert.equal(state.biome, 'hills');
      assert.equal(state.cameraCell, '9,10',
        'Use a reachable off-road B2 habitat eye, not a cobblestone road');
      assert.ok(Math.abs(Number(state.cameraYaw) - Math.PI) < 0.00001,
        'The south-facing POV must differ from the west-facing ruin eye');
      assert.ok(Math.abs(Number(state.cameraPitch)) < 0.00001,
        'Do not tilt the camera to manufacture a pleasing screenshot');
      assert.equal(state.coarsePointer, String(coarse));
      assert.equal(state.overflow, false);
      assert.equal(state.canvasWidth, width);
      assert.equal(state.canvasHeight, height);
      assert.equal(state.realGround, 'true');
      assert.equal(state.realScenery, 'true');
      assert.equal(state.skyPresent, 'true');
      assert.ok(Number(state.batchCount) > 2 && Number(state.batchCount) < 45);
      assert.ok(Number(state.drawCalls) > 0 && Number(state.drawCalls) <= 20,
        'Heath QA must not add an explosion of draw calls to the real scene');
      assert.ok(Number(state.pixelVariants) > 20, 'Real first-person frame must not be blank');
      assert.ok(Number(state.lowHeatherInstances) > 10,
        'The same B2 reusable groundcover must be instantiated from the spawn');
      assert.equal(Number(state.lowHeatherVertices), 168,
        'The v66 low, branched rosette geometry must remain unchanged');
      console.log('CHRONICLES_TERRA_B2_HEATH_PIXELS width=' + width
        + ' visible=' + state.lowHeatherVisiblePixels
        + ' instances=' + state.lowHeatherInstances
        + ' targetChanged=' + state.targetChangedSamples
        + ' batches=' + state.batchCount + ' calls=' + state.drawCalls);
      assert.ok(Number(state.lowHeatherVisiblePixels) > 25,
        'Hiding ONLY the rosette batch must change genuine off-road player pixels: '
          + JSON.stringify(state));
      assert.ok(Number(state.targetChangedSamples) > 15
        && Number(state.targetPixelDifference) > 5,
      'Real rock and vegetation landscape tiles must remain perceptible');
      assert.ok((await stat(filename)).size > 20000,
        'B2 second-eye screenshot must contain actual 3D scene pixels');
      captures.push(state);
      console.log('CHRONICLES_TERRA_B2_HEATH_POV_OK width=' + width
        + ' eye=' + state.cameraCell + ' yaw=' + state.cameraYaw
        + ' plants=' + state.lowHeatherInstances
        + ' realHeatherPixels=' + state.lowHeatherVisiblePixels
        + ' batches=' + state.batchCount + ' calls=' + state.drawCalls
        + ' file=' + filename);
    } finally {
      await context.close();
    }
  }
  assert.ok(Number(captures[0].lowHeatherInstances)
    < Number(captures[1].lowHeatherInstances),
  'Mobile B2 must keep fewer low-heath instances than desktop');
  assert.ok(Number(captures[0].tuftCount) <= Number(captures[1].tuftCount),
    'Mobile foothill tufts must stay within desktop instance budget');
  assert.ok(Number(captures[0].pebbleCount) <= Number(captures[1].pebbleCount),
    'Mobile foothill scree must stay within desktop instance budget');
} finally {
  await browser.close();
}
