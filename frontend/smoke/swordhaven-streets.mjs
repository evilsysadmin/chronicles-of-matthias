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
  // Keep the full visual contract at 390 and desktop. Add compact 360/430
  // storefront photography to catch narrow-phone crop regressions cheaply.
  // Two locations × four compass headings, rendered at portrait and desktop
  // widths. The existing smoke artifact upload retains each real WebGL frame.
  const skyViews = [
    'sky-plaza-north', 'sky-plaza-east', 'sky-plaza-south', 'sky-plaza-west',
    'sky-ward-north', 'sky-ward-east', 'sky-ward-south', 'sky-ward-west',
  ];
  const fullViews = ['gate-north', 'oldtown', 'mayor-square', 'fountain', 'home-gable', 'apothecary', 'guild', 'guild-oblique', 'forge', 'forge-oblique', 'armor', 'armor-oblique', 'temple', 'store', 'store-oblique', 'store-side', 'tavern', 'tavern-oblique', 'watch', 'alley', 'ward', 'lantern', 'juliet', 'laundry', 'roofline', 'chimney', ...skyViews];
  const portraitShops = ['apothecary', 'guild', 'forge', 'armor', 'temple', 'store', 'tavern'];
  const skyWeatherScenarios = ['clear', 'rain', 'dawn', 'dusk',
    'dusk-clear', 'dusk-cloudy', 'night'];
  for (const width of [360, 390, 430, 1280]) {
    const height = width === 1280 ? 800 : width === 360 ? 800 : width === 430 ? 932 : 844;
    // Fresh navigation recreates the real WebGL scene; one browser context per
    // viewport keeps renderer initialization bounded.
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      const shots = (width === 360 || width === 430 ? portraitShops : fullViews)
        .map(view => ({ view, weather: null }));
      // Two reference widths photograph authentic sunny/overcast sunsets
      // toward Terra's actual solar azimuth. 360/430 shops stay unchanged.
      if (width === 390 || width === 1280) {
        shots.push(...skyWeatherScenarios.map(weather => ({
          view: weather === 'dawn' ? 'sky-plaza-west'
            : weather.startsWith('dusk') ? 'sky-plaza-east' : 'sky-plaza-south',
          weather,
        })));
      }
      for (const { view, weather } of shots) {
        const pageErrors = [];
        const onPageError = error => pageErrors.push(error.message);
        page.on('pageerror', onPageError);
        try {
        await page.goto(
          url + '?view=' + view + '&coarse=' + (width === 1280 ? '0' : '1')
            + (weather ? '&weather=' + weather : ''),
          { waitUntil: 'domcontentloaded' },
        );
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
        await page.screenshot({
          path: 'smoke-swordhaven-' + view + (weather ? '-' + weather : '') + '-' + width + '.png',
        });
        assert.equal(result.sceneError, undefined, JSON.stringify(result));
        assert.equal(result.sceneReady, 'true');
        assert.equal(result.mapId, 'swordhaven-first-book');
        assert.equal(result.tieredPlazaFountain, 'true',
          'The real (9,9) square must contain the two-tier bowl and four shared water jets');
        assert.equal(result.fountainPortraitFraming, 'true',
          'The dedicated fountain view must fit lower stone rim and upper finial at 390 and 1280px');
        if (view === 'fountain') assert.equal(result.cameraCell, '9,7');
        assert.equal(result.premiumCivic, 'true', 'The real mayor hall needs its carved civic facade');
        assert.equal(result.premiumHomes, 'true', 'Residential houses need the premium shuttered facade');
        assert.equal(result.premiumHomeGables, 'true',
          'Authored houses must display an upper attic vent and cached limewash without false shop signs');
        assert.equal(result.premiumStreetWindows, 'true',
          'Swordhaven streets need actual batched oak hoods and planted window ledges');
        assert.equal(result.alleyLaundry, 'true',
          'Four walkable residential passages should carry batched overhead lines and folded cloth');
        assert.equal(result.laundryMobileFraming, 'true',
          'The dedicated clothesline view must include every folded sheet in the mobile frustum');
        assert.equal(result.wroughtIronLanterns, 'true',
          'Three wall sconces must have iron cages, gabled hoods and amber glass in their original batches');
        assert.equal(result.lanternMobileFraming, 'true',
          'The portrait lantern shot must contain the whole genuine iron-framed sconce');
        assert.equal(result.upperJulietGuards, 'true',
          'Eight south-facing upper windows need sparse wrought-iron Juliet guards with no street collision');
        assert.equal(result.julietMobileFraming, 'true',
          'The dedicated Juliet shot must visibly frame the actual wrought-iron upper guard in portrait');
        assert.equal(result.streetView, view);
        assert.equal(result.skyCoarsePointer, String(width !== 1280),
          'Desktop must use desktop Three.js budget; portrait must use touch budget');
        if (skyViews.includes(view)) {
          assert.equal(result.skyCapture, 'true');
          assert.equal(result.skyAnchored, 'true',
            'Sky dome, panorama and all cloud banks must remain camera-relative on every heading');
          assert.equal(result.skySeamless, 'true',
            'The procedural panoramic atlas must have identical pixels across its 360-degree seam');
          assert.equal(Number(result.skyCloudCount), width === 1280 ? 8 : 4,
            'Cloud bank count must match the actual desktop/touch budget');
          assert.equal(Number(result.skyAtlasWidth), width === 1280 ? 512 : 256,
            'Panoramic atlas resolution must match the actual desktop/touch budget');
        }
        if (weather) {
          assert.equal(result.skyScenario, weather);
          assert.ok(Number(result.skyWorldMinutes) >= 0,
            'Sky photos must use reproducible persisted Terra minutes');
          assert.ok(Number(result.skyCloudiness) >= 0);
          if (weather === 'clear' || weather === 'rain') {
            assert.equal(result.skyWeatherKind, weather,
              'Weather scenario must be sampled from actual regional weather');
            assert.ok(Number(result.skyDaylight) > 0.9,
              'Weather comparison must have comparable midday sunlight');
            assert.equal(result.skySunVisible, 'true');
            assert.equal(result.skyPrecipitation, weather === 'rain' ? 'rain' : 'none');
            if (weather === 'rain') {
              assert.ok(Number(result.skyPanoramaOpacity) > 0.6,
                'Rain must darken the existing real panorama');
            } else {
              assert.ok(Number(result.skyPanoramaOpacity) < 0.3,
                'Clear weather must restore the lighter panorama');
            }
          } else if (weather === 'dawn' || weather.startsWith('dusk')) {
            if (weather === 'dusk-clear' || weather === 'dusk-cloudy') {
              const kind = weather === 'dusk-clear' ? 'clear' : 'cloudy';
              assert.equal(result.skyWeatherKind, kind,
                'Sunset must use authentic regional weather, not a mocked tint');
              assert.ok(kind === 'clear'
                ? Number(result.skyCloudiness) <= 0.08
                : Number(result.skyCloudiness) >= 0.54,
              'Sunset weather must have completed its 40-minute transition');
              assert.equal(result.skyPrecipitation, 'none');
              assert.ok(kind === 'clear'
                ? Number(result.skyPanoramaOpacity) < 0.20
                : Number(result.skyPanoramaOpacity) > 0.50,
              'Actual sunset cloud cover must change panorama opacity');
            }
            assert.ok(Number(result.skyTwilight) > 0.9,
              'Twilight must track seasonal sunrise/sunset, not a fixed wall-clock hour');
            assert.ok(Number(result.skyDaylight) > 0.1
              && Number(result.skyDaylight) < 0.9);
            assert.ok(Number(result.skySunFacing) > 0.9,
              'Twilight captures must look toward the genuine seasonal solar azimuth');
          } else if (weather === 'night') {
            assert.ok(Number(result.skyDaylight) < 0.01);
            assert.equal(result.skySunVisible, 'false');
          }
        }
        assert.equal(Number(result.wallHeight), 6.4,
          'Street view must not regress to 1.6m parapet');
        // One of the 80 wall cells is now an actual arched gateway, not a
        // solid instanced cube. The other 79 remain reliably rendered.
        assert.equal(Number(result.wallCount), 125);
        assert.equal(Number(result.perimeterCount), 79);
        assert.equal(result.gateOpening, 'true',
          'Swordhaven north gate must be an actual opening with visible arch and outgoing road');
        assert.equal(result.perimeterUnculled, 'true',
          'The town enclosure must not vanish under camera frustum culling');
        assert.ok(Number(result.roadCount) > 100);
        assert.equal(Number(result.plasterCount), 188);
        assert.equal(result.twoStoreyLimewash, 'true',
          'Upper-floor limewash must be paler than the weathered ground floor, with no extra meshes');
        assert.equal(result.domesticDoors, 'true',
          'Closed residential oak entries need shared frame and iron batches on real blind facades');
        assert.equal(result.domesticJoinery, 'true',
          'Raised oak boards and forged straps must fit the original door batches inside blocked cells');
        assert.equal(result.domesticPediments, 'true',
          'All oak residential doors need raised twin-pitched lintels below the storey beam');
        assert.equal(result.windowDetail, 'true',
          'Rendered street windows must have merged mullions and sills inside solid cells');
        assert.equal(result.inhabitedWindowTints, 'true',
          'Residential windows must vary oak and reflected glass colours without extra lights or draw calls');
        assert.equal(result.plasterRelief, 'true',
          'Real street facades must use aligned, shared limewash relief');
        assert.equal(Number(result.roofCount), 7);
        assert.equal(result.premiumRoofline, 'true',
          'Seven Swordhaven terrace roofs must show coherent batched oak eaves, ridges and gable verges');
        assert.equal(result.eaveKneeBraces, 'true',
          'Seven authored terraces need paired oak knee braces beneath each real eave, well above the street');
        assert.equal(result.premiumResidentialDormers, 'true',
          'Residential roof runs must have real raised dormers and roof windows without extra lighting or colliders');
        assert.equal(result.readableDormerWindows, 'true',
          'All residential dormers must have real oak casements and legible leaded glass from the streets');
        assert.equal(result.distinctGuildDoor, 'true',
          'Guild door must have its own violet oak leaves and brass fittings behind the existing portal');
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
        assert.equal(result.distinctArmorGate, 'true',
          'Armorer needs a full-height riveted iron gateway, distinct from forge and guild doors');
        assert.equal(result.distinctForgeDoor, 'true',
          'Forge needs its own ironbound oak door, not another generic merchant entrance');
        assert.equal(result.distinctMetalworkFacades, 'true',
          'Forge must have a unique street-level ironwork bay and chimney, distinct from armorer');
        assert.equal(result.deepForgeWorkshop, 'true',
          'Forge workshop must have deeper stone jamb returns and a real iron-lipped hearth');
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
        assert.equal(result.variedRoofPitches, 'true',
          'Seven authored rooflines need four heights with matching oak ridges and angled verges');
        assert.equal(result.inhabitedChimneys, 'true',
          'Sparse residential chimney shafts and dark flues must sit in real varied roof slopes');
        assert.equal(result.inhabitedChimneyMasonry, 'true',
          'Residential chimney shafts need a staggered mortar bond and raised four-sided flue surround');
        // Two upper-storey braces on every blind face, including above the
        // closed doorways, reuse the current timber batch and remain inside
        // the originally blocked walls. Lower doorway braces stay removed.
        assert.ok(Number(result.domesticDoorCount) >= 5);
        assert.equal(result.upperStoreyTimber, 'true',
          'Upper residential floor needs visible angled oak trusses within the solid facade');
        assert.equal(Number(result.cornerUprights)
          + 2 * Number(result.domesticDoorCount) - Number(result.upperTrussCount), 318);
        // A close masonry facade at phone width may occupy almost the entire
        // frame with just a few colours. Only reject a truly flat framebuffer.
        assert.ok(Number(result.pixelVariants) >= 2,
          'Blank WebGL framebuffer: ' + JSON.stringify(result));
        assert.equal(result.canvasWidth, width);
        assert.equal(result.canvasHeight, height);
        assert.equal(Number(result.cameraFov), width === 1280 ? 67 : 79,
          'Swordhaven smoke must use the same portrait town lens as the game');
        assert.equal(result.overflowing, false);
        assert.deepEqual(pageErrors, []);
        console.log('OK real Swordhaven 3D ' + view + (weather ? '/' + weather : '') + ' ' + width + 'px');
        } catch (error) {
          failures.push(view + (weather ? '/' + weather : '') + '/' + width + ': ' + error.message);
          console.error('FAIL Swordhaven 3D smoke', view, weather, width, error);
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
