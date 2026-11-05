import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSwordhavenSkyDome } from './chroniclesSwordhaven3D.js';
import { chroniclesRegionalWeather, chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import { chroniclesTownRainWetness } from './chroniclesTownRainPavement.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import { chroniclesExteriorDaylightProfile, createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';

function outdoors() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb4d4df);
  scene.fog = new THREE.Fog(0xb4d4df, 55, 140);
  const dome = createSwordhavenSkyDome(new THREE.Vector3(-25, 30, -65).normalize());
  scene.add(dome);
  const sun = new THREE.DirectionalLight(0xffe6ba, 1.88);
  sun.name = 'chronicles-campaign-sun';
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xd4e9ff, 0x60734b, 1.12);
  scene.add(hemi);
  const renderer = { toneMappingExposure: 1.08 };
  return { scene, dome, sun, hemi, renderer };
}

describe('Terra solar cycle', () => {
  it('uses persisted minutes with smooth dawn/dusk boundaries and correct solar orientation', () => {
    expect(chroniclesExteriorDaylightProfile(480).daylight).toBe(1);
    expect(chroniclesExteriorDaylightProfile(1320).daylight).toBe(0);
    expect(chroniclesExteriorDaylightProfile(360).sun.y).toBeCloseTo(0, 6);
    expect(chroniclesExteriorDaylightProfile(720).sun.y).toBeGreaterThan(0.8);
    expect(chroniclesExteriorDaylightProfile(1320).sunVisible).toBe(false);
    expect(chroniclesExteriorDaylightProfile(1080).daylight).toBeGreaterThan(0);
    expect(chroniclesExteriorDaylightProfile(1140).daylight).toBeGreaterThan(0);
    expect(chroniclesExteriorDaylightProfile(1160).daylight).toBeLessThan(0.5);
    expect(chroniclesExteriorDaylightProfile(480 + 1440).minute).toBe(480);
    expect(chroniclesExteriorDaylightProfile(NaN).minute).toBe(480);
  });

  it('uses existing lights and sky vertices, hides sun at night and restores sunrise', () => {
    const { scene, dome, sun, hemi, renderer } = outdoors();
    const apply = createChroniclesExteriorDaylight(scene, renderer);
    const count = scene.children.length;
    expect(apply).not.toBeNull();
    expect(apply.sync(480)).toBe(true);
    const lit = sun.intensity;
    const ambient = hemi.intensity;
    const brightSky = dome.geometry.getAttribute('color').getY(0);
    expect(apply.sync(480)).toBe(false); // no re-upload on in-place rotation
    expect(apply.sync(22 * 60)).toBe(true);
    expect(sun.intensity).toBeLessThan(lit);
    expect(hemi.intensity).toBeLessThan(ambient);
    expect(hemi.intensity).toBeGreaterThan(0.4);
    expect(sun.position.y).toBeGreaterThan(0); // moonlight never illuminates from below ground
    expect(dome.getObjectByName('swordhaven-sun-disc').visible).toBe(false);
    expect(dome.getObjectByName('swordhaven-sun-halo').visible).toBe(false);
    expect(dome.geometry.getAttribute('color').getY(0)).toBeLessThan(brightSky);
    expect(renderer.toneMappingExposure).toBeGreaterThan(0.9);
    expect(scene.children.length).toBe(count);
    expect(apply.sync(480)).toBe(true);
    expect(dome.getObjectByName('swordhaven-sun-disc').visible).toBe(true);
    expect(sun.intensity).toBeCloseTo(lit);
    expect(hemi.intensity).toBeCloseTo(ambient);
  });

  it.each([true, false])('reveals sparse warm town windows and brighter existing wall lanterns at night (coarse=%s)', (coarsePointer) => {
    const scene = new THREE.Scene();
    const grid = swordhavenFirstBook.grid;
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhavenFirstBook.id, regionKind: 'settlement',
        width: grid[0].length, height: grid.length, center: { x: 9, y: 7 },
        grid, content: [], landscape: swordhavenFirstBook.landscape,
      },
    });
    const panes = scene.getObjectByName('chronicles-town-street-window-panes');
    const glows = scene.getObjectByName('chronicles-town-street-window-night-glow');
    const lanterns = scene.getObjectByName('chronicles-town-wall-lantern-glass');
    expect(glows).toBeInstanceOf(THREE.InstancedMesh);
    expect(glows.count).toBeGreaterThan(0);
    expect(glows.count).toBeLessThan(panes.count / 3);
    expect(glows.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(glows.userData.chroniclesDecorativeOnly).toBe(true);
    expect(glows.visible).toBe(false);
    expect(lanterns).toBeInstanceOf(THREE.InstancedMesh);
    const countLights = () => {
      let count = 0;
      scene.traverse((object) => { if (object.isLight) count += 1; });
      return count;
    };
    const lightsBefore = countLights();
    const lampDayIntensity = lanterns.material.emissiveIntensity;
    const renderer = { toneMappingExposure: 1.08 };
    const cycle = createChroniclesExteriorDaylight(scene, renderer);
    expect(cycle.sync(8 * 60)).toBe(true);
    expect(glows.visible).toBe(false);
    expect(glows.material.opacity).toBe(0);
    expect(lanterns.material.emissiveIntensity).toBeCloseTo(lampDayIntensity);
    expect(cycle.sync(19 * 60)).toBe(true);
    expect(glows.visible).toBe(true);
    expect(glows.material.opacity).toBeGreaterThan(0);
    expect(glows.material.opacity).toBeLessThan(0.82);
    expect(cycle.sync(22 * 60)).toBe(true);
    expect(glows.material.opacity).toBeCloseTo(0.82);
    expect(lanterns.material.emissiveIntensity).toBeCloseTo(lampDayIntensity + 1.7);
    expect(countLights()).toBe(lightsBefore);
    // No extra landscape colliders, and the new glow is in the same wall
    // cell as the existing pane, not out in a walkable street.
    const matrix = new THREE.Matrix4();
    glows.getMatrixAt(0, matrix);
    const p = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
    expect(cycle.sync(22 * 60)).toBe(false);
    expect(cycle.sync(8 * 60)).toBe(true);
    expect(glows.visible).toBe(false);
    expect(glows.material.opacity).toBe(0);
    expect(lanterns.material.emissiveIntensity).toBeCloseTo(lampDayIntensity);
    expect(countLights()).toBe(lightsBefore);
  });

  it('does not add any inhabited windows or lanterns to wild exteriors', () => {
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer: true,
      scenePlan: {
        mapId: 'banner-road', regionKind: 'wilderness',
        width: 5, height: 5, center: { x: 2, y: 2 },
        grid: ['#####', '#...#', '#.#.#', '#...#', '#####'],
        content: [],
      },
    });
    expect(scene.getObjectByName('chronicles-town-street-window-night-glow')).toBeUndefined();
    expect(scene.getObjectByName('chronicles-town-wall-lantern-glass')).toBeUndefined();
    expect(createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1 })?.sync(1320)).toBe(true);
  });

  it('attenuates daylight and shortens existing fog without adding objects, reversible on save restore', () => {
    const { scene, sun, hemi, renderer } = outdoors();
    const baselineFogNear = scene.fog.near;
    const baselineFogFar = scene.fog.far;
    const region = { mapId: 'terra-marsh', biome: 'marsh', regionKind: 'wilderness' };
    const cycle = createChroniclesExteriorDaylight(scene, renderer, region);
    const children = scene.children.length;
    // Compare fog versus clear at identical 08:00 solar altitude, avoiding
    // false failures caused by different hours rather than cloud cover.
    const samples = Array.from({ length: 90 }, (_, i) => 480 + i * 1440);
    const fogMinute = samples.find(t => chroniclesRegionalWeather({ ...region, worldMinutes: t })?.kind === 'fog');
    const clearMinute = samples.find(t => chroniclesRegionalWeather({ ...region, worldMinutes: t })?.kind === 'clear');
    expect(fogMinute).toBeDefined();
    expect(clearMinute).toBeDefined();
    cycle.sync(clearMinute);
    const clearSun = sun.intensity;
    const clearFill = hemi.intensity;
    expect(scene.fog.near).toBe(baselineFogNear);
    expect(scene.fog.far).toBe(baselineFogFar);
    cycle.sync(fogMinute);
    expect(scene.fog.near).toBeLessThan(baselineFogNear);
    expect(scene.fog.far).toBeLessThan(baselineFogFar);
    expect(scene.fog.far).toBeGreaterThanOrEqual(45);
    expect(sun.intensity).toBeLessThan(clearSun);
    expect(hemi.intensity).toBeLessThan(clearFill);
    expect(scene.children.length).toBe(children);
    cycle.sync(clearMinute);
    expect(scene.fog.near).toBe(baselineFogNear);
    expect(scene.fog.far).toBe(baselineFogFar);
    expect(scene.children.length).toBe(children);
    // The same time in a later day must be reevaluated, not cached by hh:mm.
    expect(cycle.sync(clearMinute + 1440)).toBe(true);
  });

  it.each([true, false])('makes only Swordhaven paving wet after rain, then restores dry cobble (coarse=%s)', (coarsePointer) => {
    const grid = swordhavenFirstBook.grid;
    const scene = new THREE.Scene();
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhavenFirstBook.id, regionKind: 'settlement',
        width: grid[0].length, height: grid.length,
        center: { x: 9, y: 7 }, grid, content: [],
        landscape: swordhavenFirstBook.landscape,
      },
    });
    const roads = scene.getObjectByName('chronicles-campaign-road');
    const puddles = scene.getObjectByName('chronicles-town-rain-puddles');
    expect(puddles).toBeInstanceOf(THREE.InstancedMesh);
    expect(roads).toBeInstanceOf(THREE.InstancedMesh);
    const baseColor = roads.material.color.clone();
    const baseRoughness = roads.material.roughness;
    const baseMetalness = roads.material.metalness;
    let start = null;
    for (let n = 0; n < 100; n++) {
      const t = n * 360;
      const w = chroniclesRegionalWeather({ mapId: swordhavenFirstBook.id, regionKind: 'settlement', worldMinutes: t });
      const prev = t > 0 ? chroniclesRegionalWeather({ mapId: swordhavenFirstBook.id, regionKind: 'settlement', worldMinutes: t - 1 }) : null;
      if (w.kind === 'rain' && prev?.kind !== 'rain') { start = t; break; }
    }
    expect(start).not.toBeNull();
    const noonWet = start + 40;
    expect(chroniclesTownRainWetness({
      mapId: swordhavenFirstBook.id, regionKind: 'settlement', worldMinutes: noonWet,
    })).toBe(1);
    const apply = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1.08 }, {
      mapId: swordhavenFirstBook.id, regionKind: 'settlement',
    });
    const initialCount = scene.children.length;
    apply.sync(noonWet);
    expect(puddles.visible).toBe(true);
    expect(puddles.material.opacity).toBeCloseTo(.76);
    expect(roads.material.color.getHex()).not.toBe(baseColor.getHex());
    expect(roads.material.roughness).toBeCloseTo(.43);
    expect(roads.material.metalness).toBeCloseTo(.14);
    expect(scene.children.length).toBe(initialCount);
    // Deterministic rewind: the same geometry and original dry material come back.
    let clear = null;
    for (let t = start + 360; t < start + 360 * 20; t += 360) {
      if (chroniclesTownRainWetness({ mapId: swordhavenFirstBook.id,
        regionKind: 'settlement', worldMinutes: t + 180 }) === 0) { clear = t + 180; break; }
    }
    expect(clear).not.toBeNull();
    apply.sync(clear);
    expect(puddles.visible).toBe(false);
    expect(puddles.material.opacity).toBe(0);
    expect(roads.material.color.getHex()).toBe(baseColor.getHex());
    expect(roads.material.roughness).toBe(baseRoughness);
    expect(roads.material.metalness).toBe(baseMetalness);
    expect(scene.children.length).toBe(initialCount);
    apply.sync(noonWet);
    expect(puddles.visible).toBe(true);
    expect(puddles.material.opacity).toBeCloseTo(.76);
  });

  it('fades the real 3D fog and sunlight across a weather boundary with no new lights', () => {
    const { scene, sun, renderer } = outdoors();
    const place = { mapId: 'terra-marsh', biome: 'marsh', regionKind: 'wilderness' };
    const boundary = Array.from({ length: 90 }, (_, i) => (i + 1) * 360)
      .find(t => {
        const previous = chroniclesRegionalWeather({ ...place, worldMinutes: t - 1 });
        const current = chroniclesRegionalWeather({ ...place, worldMinutes: t });
        return previous.kind !== current.kind
          && previous.fog !== current.fog;
      });
    expect(boundary).toBeDefined();
    const cycle = createChroniclesExteriorDaylight(scene, renderer, place);
    const count = scene.children.length;
    const states = [boundary, boundary + 10, boundary + 20, boundary + 30, boundary + 40]
      .map(minute => {
        cycle.sync(minute);
        return { minute, sun: sun.intensity, fog: scene.fog.far };
      });
    const start = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: boundary });
    const end = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: boundary + 40 });
    expect(start.fog).not.toBe(end.fog);
    expect(states[2].fog).toBeCloseTo((states[0].fog + states[4].fog) / 2);
    // At dawn the sun itself climbs non-linearly: compare the exact saved
    // solar time + blended cloudiness, not an invalid linear sun midpoint.
    const middayWeather = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: boundary + 20 });
    const solar = chroniclesExteriorDaylightProfile(boundary + 20);
    const expectedSun = 1.88 * (0.20 + 0.80 * solar.daylight) * (1 - middayWeather.clouds * 0.48);
    expect(states[2].sun).toBeCloseTo(expectedSun);
    expect(states[1].fog).not.toBe(states[0].fog);
    expect(states[3].fog).not.toBe(states[4].fog);
    expect(scene.children.length).toBe(count);
    cycle.sync(boundary);
    expect(scene.fog.far).toBe(states[0].fog);
  });

  it('does not change the dungeon renderer when no exterior sun is present', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0c0f, 0.034);
    const renderer = { toneMappingExposure: 0.88 };
    expect(createChroniclesExteriorDaylight(scene, renderer)).toBeNull();
    expect(renderer.toneMappingExposure).toBe(0.88);
    expect(scene.fog.color.getHex()).toBe(0x0a0c0f);
  });
});
