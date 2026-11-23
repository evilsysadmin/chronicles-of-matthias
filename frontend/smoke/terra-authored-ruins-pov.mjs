// Terra v63: three additional, truly walkable first-person observation
// points directly facing their authored ruin on C4/A1/B2. These supplement,
// never replace, eight historical canonical/flank POVs of C4 and E2.
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4174/smoke/terra-landscape-pov.html';
const sites = Object.freeze({
  'terra-c4': Object.freeze({ eye: '10,9', target: '13,9',
    yaw: -Math.PI / 2, biome: 'plains' }),
  'terra-a1': Object.freeze({ eye: '10,5', target: '14,5',
    yaw: -Math.PI / 2, biome: 'snow' }),
  'terra-b2': Object.freeze({ eye: '7,8', target: '3,8',
    yaw: Math.PI / 2, biome: 'hills' }),
});
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const [mapId, expected] of Object.entries(sites)) {
    for (const [width, height, coarse] of [[390, 844, true], [1280, 800, false]]) {
      const context = await browser.newContext({
        viewport: { width, height }, deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const filename = 'smoke-terra-landscape-' + mapId + '-' + width + '-ruin.png';
      try {
        await page.goto(url + '?map=' + mapId + '&view=ruin&coarse='
          + (coarse ? '1' : '0'), { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.dataset.sceneReady === 'true'
          || Boolean(document.body.dataset.sceneError), null, { timeout: 30000 });
        const state = await page.evaluate(() => ({
          ...document.body.dataset,
          canvasWidth: document.querySelector('#stage')?.width,
          canvasHeight: document.querySelector('#stage')?.height,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        // Retain even failing real WebGL screenshot for subsequent review.
        await page.screenshot({ path: filename });
        assert.equal(state.sceneError, undefined, JSON.stringify(state));
        assert.deepEqual(errors, [], 'No runtime error in authored ruin POV');
        assert.equal(state.sceneReady, 'true');
        assert.equal(state.view, 'ruin');
        assert.equal(state.mapId, mapId);
        assert.equal(state.biome, expected.biome);
        assert.equal(state.cameraCell, expected.eye);
        assert.equal(state.authoredRuinCell, expected.target);
        assert.ok(Math.abs(Number(state.cameraYaw) - expected.yaw) < 0.00001);
        assert.ok(Math.abs(Number(state.cameraPitch)) < 0.00001);
        assert.equal(state.coarsePointer, String(coarse));
        assert.equal(state.realGround, 'true');
        assert.equal(state.realScenery, 'true');
        assert.equal(state.skyPresent, 'true');
        assert.equal(state.overflow, false);
        assert.equal(state.canvasWidth, width);
        assert.equal(state.canvasHeight, height);
        assert.equal(Number(state.ruinInstances), 3,
          'Exactly the three existing blocked-cell boulders, no new draw batches');
        assert.ok(Number(state.ruinVisiblePixels) > 15,
          'Hiding only the authored ruin must change real visible framebuffer pixels');
        if (mapId === 'terra-b2') {
          assert.ok(Number(state.lowHeatherInstances) > 10,
            'B2 must re-use the existing heather batch on walkable foothill cells');
          assert.ok(Number(state.lowHeatherVisiblePixels) > 25,
            'Low B2 heather must change genuine player-eye pixels, not exist offscreen');
        } else {
          assert.equal(Number(state.lowHeatherInstances), 0);
          assert.equal(Number(state.lowHeatherVisiblePixels), 0);
        }
        assert.ok(Number(state.batchCount) > 2 && Number(state.batchCount) < 45);
        assert.ok(Number(state.drawCalls) > 0 && Number(state.drawCalls) < 160);
        assert.ok(Number(state.pixelVariants) > 20);
        assert.ok((await stat(filename)).size > 20000,
          'Real authored ruin screenshot must not be blank');
        console.log('CHRONICLES_TERRA_RUIN_POV_OK map=' + mapId
          + ' width=' + width + ' eye=' + state.cameraCell
          + ' ruin=' + state.authoredRuinCell
          + ' visiblePixels=' + state.ruinVisiblePixels
          + ' instances=' + state.ruinInstances
          + ' lowHeath=' + state.lowHeatherInstances
          + ' heathPixels=' + state.lowHeatherVisiblePixels
          + ' batches=' + state.batchCount + ' calls=' + state.drawCalls
          + ' file=' + filename);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
