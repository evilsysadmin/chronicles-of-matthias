// Supplemental terrain QA: four genuinely different eye-level WebGL views
// of real, authored C4/E2 terrain. Never replace the four stable canonical
// frames in terra-landscape-pov.mjs; their historical comparison must survive.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/terra-landscape-pov.html';
const views = Object.freeze({
  'terra-c4': Object.freeze({ eye: '5,5', yaw: Math.PI / 2, biome: 'plains' }),
  'terra-e2': Object.freeze({ eye: '12,7', yaw: -Math.PI / 2, biome: 'hills' }),
});
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [mapId, expected] of Object.entries(views)) {
    const budgets = [];
    for (const [width, height, coarse] of [[390, 844, true], [1280, 800, false]]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const filename = 'smoke-terra-landscape-' + mapId + '-' + width + '-flank.png';
      try {
        await page.goto(url + '?map=' + mapId + '&coarse=' + (coarse ? '1' : '0')
          + '&view=flank', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.dataset.sceneReady === 'true'
          || Boolean(document.body.dataset.sceneError), null, { timeout: 30000 });
        const state = await page.evaluate(() => ({
          ...document.body.dataset,
          canvasWidth: document.querySelector('#stage')?.width,
          canvasHeight: document.querySelector('#stage')?.height,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        // Preserve a real failing frame for diagnosis before any assertion.
        await page.screenshot({ path: filename });
        assert.equal(state.sceneError, undefined, JSON.stringify(state));
        assert.deepEqual(errors, [], 'No real Three.js errors while turning to ' + mapId);
        assert.equal(state.sceneReady, 'true');
        assert.equal(state.view, 'flank');
        assert.equal(state.mapId, mapId);
        assert.equal(state.biome, expected.biome);
        assert.equal(state.cameraCell, expected.eye,
          'Must be a second ACTUAL traversable camera position, not the canonical POV');
        assert.ok(Math.abs(Number(state.cameraYaw) - expected.yaw) < 0.00001,
          'Flank must face an exact playable cardinal direction');
        assert.ok(Math.abs(Number(state.cameraPitch)) < 0.00001,
          'Never fake a flattering landscape shot with a camera tilt');
        assert.equal(state.coarsePointer, String(coarse));
        assert.equal(state.realGround, 'true');
        assert.equal(state.realScenery, 'true');
        assert.equal(state.skyPresent, 'true');
        assert.equal(state.overflow, false);
        assert.equal(state.canvasWidth, width);
        assert.equal(state.canvasHeight, height);
        assert.ok(Number(state.batchCount) > 2 && Number(state.batchCount) < 45,
          'Additional camera views cannot create a new instance batch');
        assert.ok(Number(state.drawCalls) > 0 && Number(state.drawCalls) < 160,
          'True second-eye scene must keep existing rendering budget');
        assert.ok(Number(state.pixelVariants) > 20, 'No blank/solid real framebuffer');
        assert.ok(Number(state.targetChangedSamples) > 15,
          'Genuine landscape vegetation/rocks must produce visible pixels from the flank');
        assert.ok(Number(state.targetPixelDifference) > 5,
          'Real species must have meaningful contrast from the second perspective');
        assert.ok((await stat(filename)).size > 20000,
          'Real first-person flank screenshot must not be empty');
        budgets.push(state);
        console.log('CHRONICLES_TERRA_FLANK_POV_OK map=' + mapId + ' width=' + width
          + ' eye=' + state.cameraCell + ' yaw=' + state.cameraYaw
          + ' batches=' + state.batchCount + ' calls=' + state.drawCalls
          + ' changed=' + state.targetChangedSamples
          + ' file=' + filename);
      } finally {
        await context.close();
      }
    }
    assert.ok(Number(budgets[0].tuftCount) <= Number(budgets[1].tuftCount),
      'Existing mobile grass budget must remain a subset in a second camera view');
    if (mapId === 'terra-e2') {
      assert.ok(Number(budgets[0].pebbleCount) <= Number(budgets[1].pebbleCount),
        'Existing mobile rock budget must remain bounded in a second camera view');
    }
  }
} finally {
  await browser.close();
}
