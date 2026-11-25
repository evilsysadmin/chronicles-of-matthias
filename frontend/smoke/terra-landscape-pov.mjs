// Six comparable screenshots from the real MM3 world camera, including
// C3 Banner Road's authored forest approach and real landscape WebGL evidence.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/terra-landscape-pov.html';
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mapId of ['terra-e2', 'terra-c4', 'banner-road-first-book']) {
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
        assert.deepEqual(JSON.parse(state.shaderErrors), [],
          'No WebGL shader compile/link errors in ' + mapId + ' at ' + width + 'px');
        assert.equal(state.sceneReady, 'true');
        assert.equal(state.mapId, mapId);
        assert.equal(state.cameraCell, mapId === 'terra-c4' ? '7,5'
          : mapId === 'banner-road-first-book' ? '10,13' : '10,7');
        assert.equal(state.coarsePointer, String(coarse));
        assert.equal(state.biome, mapId === 'terra-e2' ? 'hills' : 'plains');
        if (mapId === 'banner-road-first-book') {
          assert.equal(Number(state.cameraYaw), 0,
            'C3 camera must look north from the actual south approach');
        }
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
        if (mapId === 'terra-c4' && coarse) {
          // #1438 verified only 98 changed grass/flower pixels at 390px.
          // Require a meaningful, genuine mobile foreground improvement,
          // with the same strict real framebuffer evidence as before.
          // v48 reached 540 changed pixels (98 before v48). The added
          // grass drifts and shallow, real 3D microrelief must push the
          // independently measured live framebuffer well beyond that.
          assert.ok(Number(state.microreliefCount) > 8,
            '390px meadow must contain real shared ankle-high relief instances');
          assert.ok(Number(state.targetChangedSamples) > 850,
            '390px meadow foreground must exceed the prior 540-pixel real WebGL baseline');
        }
        if (mapId === 'banner-road-first-book') {
          const roadPixels = Number(state.roadVisiblePixels);
          console.log('CHRONICLES_C3_ROAD_PIXEL_EVIDENCE width=' + width + ' changed=' + roadPixels);
          assert.ok(roadPixels > width * height * 0.005,
            'C3 dirt must visibly contribute >0.5% of the real framebuffer: ' + JSON.stringify(state));
          assert.ok(Number(state.bushCount) > 10,
            'Real C3 woodland approach must include original batched shrubs');
          assert.ok(Number(state.crownCount) > 10,
            'C3 approach must preserve existing forest canopy batches');
          assert.ok(Number(state.herbCount) > 0,
            'C3 approach needs real low ground vegetation');
          // Reuse the canonical live scene/context. The noon screenshot
          // already exists; only three additional captures per viewport.
          const audit = {};
          for (const phase of ['noon', 'dawn', 'dusk', 'night']) {
            const frame = await page.evaluate(phase => window.chroniclesSmokeSolarFrame(phase), phase);
            if (phase !== 'noon') await page.screenshot({
              path: 'smoke-terra-landscape-' + mapId + '-' + width + '-' + phase + '.png',
            });
            audit[phase] = frame;
            console.log('CHRONICLES_C3_SOLAR_AUDIT width=' + width + ' ' + JSON.stringify(frame));
            assert.deepEqual(frame.shaderErrors, [], phase + ' must compile all shaders');
            assert.equal(frame.cameraCell, state.cameraCell);
            assert.equal(frame.yaw, Number(state.cameraYaw));
            assert.ok(Math.abs(frame.pitch) < 0.00001);
            assert.ok(frame.palette > 20 && frame.meanLuma > 4 && frame.groundLuma > 3,
              phase + ' must render a legible, nonblank scene');
            assert.ok(frame.drawCalls > 0 && frame.drawCalls < 160);
            if (phase !== 'noon') assert.ok(frame.changedFraction > 0.02,
              phase + ' must visibly differ from noon');
          }
          assert.ok(audit.noon.daylight > audit.dawn.daylight);
          assert.ok(audit.noon.daylight > audit.dusk.daylight);
          assert.equal(audit.night.daylight, 0);
          assert.ok(audit.night.meanLuma < audit.noon.meanLuma);
          const restored = await page.evaluate(() => window.chroniclesSmokeSolarFrame('noon'));
          assert.ok(Math.abs(restored.meanLuma - audit.noon.meanLuma) < 0.1,
            'Restoring the same world minute must restore the rendered lighting');
          if (!coarse) {
            // Three extra diagnostic images, desktop only, in the already
            // running canonical context. The normal noon frame is retained.
            try {
              for (const mode of ['no-panorama', 'no-banks', 'no-clouds']) {
                const frame = await page.evaluate(mode => window.chroniclesSmokeCloudLayer(mode), mode);
                console.log('CHRONICLES_C3_CLOUD_LAYER ' + JSON.stringify(frame));
                assert.deepEqual(frame.shaderErrors, []);
                assert.equal(frame.panoramaVisible, mode === 'no-banks');
                assert.equal(frame.visibleBanks, mode === 'no-panorama' ? 8 : 0);
                await page.screenshot({
                  path: 'smoke-terra-landscape-' + mapId + '-' + width + '-' + mode + '.png',
                });
              }
            } finally {
              const frame = await page.evaluate(() => window.chroniclesSmokeCloudLayer('all'));
              assert.equal(frame.panoramaVisible, true);
              assert.equal(frame.visibleBanks, 8);
              assert.ok(frame.changedFraction < 0.001,
                'Cloud layer diagnostics must restore the original real noon frame');
              assert.deepEqual(frame.shaderErrors, []);
            }
          }
          assert.deepEqual(errors, [], 'No browser errors during solar audit');
        } else if (mapId === 'terra-e2') {
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
