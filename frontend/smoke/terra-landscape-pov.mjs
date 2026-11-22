// Four comparable screenshots from the real MM3 world camera and the
// actual Terra maps, including WebGL evidence that landscape tiles render.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/terra-landscape-pov.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mapId of ['terra-e2', 'terra-c4']) {
    const captures = [];
    for (const [width, height, coarse] of [[390, 844, true], [1280, 800, false]]) {
      const context = await browser.newContext({
        viewport: { width, height }, deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(url + '?map=' + mapId + '&coarse=' + (coarse ? '1' : '0'),
          { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.dataset.sceneReady === 'true'
          || Boolean(document.body.dataset.sceneError), null, { timeout: 30000 });
        const state = await page.evaluate(() => ({
          ...document.body.dataset,
          width: document.querySelector('#stage')?.width,
          height: document.querySelector('#stage')?.height,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        // Keep the actual failing frame if a visual/geometry contract trips.
        const filename = 'smoke-terra-landscape-' + mapId + '-' + width + '.png';
        await page.screenshot({ path: filename });
        assert.equal(state.sceneError, undefined, JSON.stringify(state));
        assert.deepEqual(errors, [], 'No real renderer JS errors in ' + mapId);
        assert.equal(state.sceneReady, 'true');
        assert.equal(state.mapId, mapId);
        assert.equal(state.cameraCell, mapId === 'terra-c4' ? '7,5' : '10,7');
        assert.equal(state.coarsePointer, String(coarse));
        assert.equal(state.biome, mapId === 'terra-e2' ? 'hills' : 'plains');
        assert.equal(state.overflow, false);
        assert.equal(state.width, width);
        assert.equal(state.height, height);
        assert.equal(state.realGround, 'true');
        assert.equal(state.realScenery, 'true');
        assert.equal(state.skyPresent, 'true');
        assert.ok(Math.abs(Number(state.cameraPitch)) < 0.00001,
          'Real MM3 first-person view must be level, without a photo-only camera tilt');
        assert.ok(Number(state.batchCount) > 2 && Number(state.batchCount) < 45,
          'Terrain dressing must remain bounded in shared InstancedMesh batches');
        assert.ok(Number(state.drawCalls) > 0 && Number(state.drawCalls) < 160,
          'Real frame must render without an explosion of draw calls');
        assert.ok(Number(state.pixelVariants) > 20, 'Actual WebGL frame cannot be blank');
        // Dense, exact per-pixel WebGL comparison: a 9px raster sample
        // systematically missed the tiny silhouettes of mobile meadow herbs.
        // This still fails if disabling the actual species leaves the frame
        // unchanged; it does not merely assert that meshes were constructed.
        console.log('CHRONICLES_TERRA_PIXEL_EVIDENCE map=' + mapId
          + ' width=' + width + ' changed=' + state.targetChangedSamples
          + ' meanRgbDifference=' + state.targetPixelDifference);
        assert.ok(Number(state.targetChangedSamples) > 30
          && Number(state.targetPixelDifference) > 5,
        'Disabling real landscape species must change >30 actual pixels with meaningful color contrast: '
          + JSON.stringify(state));
        assert.ok((await stat(filename)).size > 20000,
          'Full first-person landscape screenshot must contain a real rendered image');
        if (mapId === 'terra-e2') {
          assert.ok(Number(state.cragCount) > 0, 'Real blocked ridges must render');
          assert.ok(Number(state.pebbleCount) > 10, 'Walkable foothills need scree');
          assert.ok(Number(state.tuftCount) > 10, 'Walkable foothills need short grasses');
        } else {
          assert.ok(Number(state.tuftCount) > 10, 'Real meadows need low grasses');
          assert.ok(Number(state.flowerCount) > 0, 'Real meadows need wildflowers');
          assert.ok(Number(state.herbCount) > 0, 'Real forest-edge habitats need low herbs');
        }
        captures.push(state);
        console.log('CHRONICLES_TERRA_POV_OK map=' + mapId
          + ' width=' + width + ' eye=' + state.cameraCell
          + ' yaw=' + state.cameraYaw
          + ' batches=' + state.batchCount
          + ' calls=' + state.drawCalls
          + ' changed=' + state.targetChangedSamples
          + ' diff=' + state.targetPixelDifference
          + ' file=' + filename);
      } finally {
        await context.close();
      }
    }
    assert.ok(Number(captures[0].tuftCount) <= Number(captures[1].tuftCount),
      'Touch grass budget cannot exceed desktop grass budget');
    if (mapId === 'terra-e2') {
      assert.ok(Number(captures[0].pebbleCount) <= Number(captures[1].pebbleCount),
        'Touch scree budget cannot exceed desktop scree budget');
    }
  }
} finally {
  await browser.close();
}
