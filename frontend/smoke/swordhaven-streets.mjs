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
    // This fixture has no cookies or storage state. A fresh navigation recreates
    // the real WebGL scene, while reusing the browser context avoids 19 GPU/
    // renderer initializations per viewport. Keep all 38 visual assertions.
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 800 : 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      for (const view of ['oldtown', 'mayor-square', 'home-gable', 'apothecary', 'guild', 'guild-oblique', 'forge', 'forge-oblique', 'armor', 'armor-oblique', 'temple', 'store', 'store-oblique', 'store-side', 'tavern', 'tavern-oblique', 'watch', 'alley', 'ward', 'roofline']) {
        const pageErrors = [];
        const onPageError = error => pageErrors.push(error.message);
        page.on('pageerror', onPageError);
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
        assert.equal(result.premiumCivic, 'true', 'The real mayor hall needs its carved civic facade');
        assert.equal(result.premiumHomes, 'true', 'Residential houses need the premium shuttered facade');
        assert.equal(result.premiumHomeGables, 'true',
          'Authored houses must display an upper attic vent and cached limewash without false shop signs');
        assert.equal(result.premiumStreetWindows, 'true',
          'Swordhaven streets need actual batched oak hoods and planted window ledges');
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
        assert.equal(Number(result.plasterCount), 188);
        assert.equal(result.twoStoreyLimewash, 'true',
          'Upper-floor limewash must be paler than the weathered ground floor, with no extra meshes');
        assert.equal(result.domesticDoors, 'true',
          'Closed residential oak entries need shared frame and iron batches on real blind facades');
        assert.equal(result.windowDetail, 'true',
          'Rendered street windows must have merged mullions and sills inside solid cells');
        assert.equal(result.plasterRelief, 'true',
          'Real street facades must use aligned, shared limewash relief');
        assert.equal(Number(result.roofCount), 7);
        assert.equal(result.premiumRoofline, 'true',
          'Seven Swordhaven terrace roofs must show coherent batched oak eaves, ridges and gable verges');
        assert.equal(result.premiumResidentialDormers, 'true',
          'Residential roof runs must have real raised dormers and roof windows without extra lighting or colliders');
        assert.equal(result.readableDormerWindows, 'true',
          'All residential dormers must have real oak casements and legible leaded glass from the streets');
        assert.equal(result.distinctGuildMasonry, 'true',
          'Guild must have its own slate masonry without merchant timberwork');
        assert.equal(result.distinctGuildButtresses, 'true',
          'Guild must have two pointed structural side buttresses, without altering the town grid');
        assert.equal(result.distinctGuildObservatory, 'true',
          'Real Swordhaven guild must have a unique roof observatory on desktop and mobile');
        assert.equal(result.distinctApothecaryMasonry, 'true',
          'Botica must have sage masonry walls and gables without merchant timber lattice');
        assert.equal(result.distinctApothecaryRoofline, 'true',
          'Botica herbarium must read clearly without domestic dormers or chimney on both viewport sizes');
        assert.equal(result.distinctShopFacades, 'true',
          'Apothecary and guild must have distinct authored silhouettes');
        assert.equal(result.distinctTempleRose, 'true',
          'Temple must have its own rose gable without domestic dormers or chimney');
        assert.equal(result.distinctTemplePortico, 'true',
          'Temple must have its own colonnaded stone entrance');
        assert.equal(result.distinctMetalworkFacades, 'true',
          'Forge must have a unique street-level ironwork bay and chimney, distinct from armorer');
        assert.equal(result.distinctForgeLantern, 'true',
          'Forge must have its own louvered smoke lantern above the street-facing gable');
        assert.equal(result.distinctForgeToolDisplays, 'true',
          'Forge windows must show iron smithing tools instead of inn flowers');
        assert.equal(result.distinctForgeSideVents, 'true',
          'Forge must have soot-darkened side vents, distinct from merchant glazing');
        assert.equal(result.distinctArmorSideGrilles, 'true',
          'Armory side walls must use iron-barred dark embrasures, not merchant amber glazing');
        assert.equal(result.distinctWatchhouse, 'true',
          'Guardhouse must have a raised crenellated lookout distinct from the armorer');
        assert.equal(result.distinctWatchhouseFrontage, 'true',
          'Guardhouse must have iron-barred dark windows instead of domestic flower boxes');
        assert.equal(result.distinctTavernBrick, 'true',
          'Tavern brick must contrast with smoke-darkened forge masonry');
        assert.equal(result.distinctTavernPorch, 'true',
          'Tavern must have a supported pitched porch, not a flat slab, on desktop and mobile');
        assert.equal(result.distinctTavernRoof, 'true',
          'Tavern must have a unique two-flue brick hearth roofline');
        assert.equal(result.distinctTavernOriel, 'true',
          'Tavern must have a real projecting east guest-room bay above its side windows');
        assert.equal(result.distinctTavernGallery, 'true',
          'Tavern east guest wing needs its real oak gallery and roof finials on desktop and mobile');
        assert.equal(result.distinctStoreLoft, 'true',
          'General store must have a broad oak attic loft, not generic domestic dormers');
        assert.equal(result.distinctStoreHoist, 'true',
          'Provisions must have a roof loading boom rather than a generic chimney');
        assert.equal(result.distinctStoreSideHatches, 'true',
          'Store must have batched oak cargo hatches on its side walls');
        assert.equal(result.distinctMarketStore, 'true',
          'Quartermaster store must have a unique overhead striped awning');
        assert.equal(result.roofRelief, 'true',
          'Real street roofs must use aligned, shared shingle relief');
        // 188 facade posts + 38 reinforced corners + 92 historical braces.
        // Each real domestic entry replaces exactly TWO braces, rather than
        // hiding or truncating the existing solid-cell timber geometry.
        assert.ok(Number(result.domesticDoorCount) >= 5);
        assert.equal(Number(result.cornerUprights) + 2 * Number(result.domesticDoorCount), 318);
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
          page.off('pageerror', onPageError);
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(failures.join('\n'));
