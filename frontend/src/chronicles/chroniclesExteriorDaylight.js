import * as THREE from 'three';
import { chroniclesWorldMinutes, chroniclesSeasonalSunTimes } from './chroniclesWorldTime.js';
import { chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import { chroniclesTownRainWetness } from './chroniclesTownRainPavement.js';

// A deterministic 24-hour profile with season-dependent sunrise and sunset.
// The 2-hour twilight transitions follow the real Terra calendar in I.
const DAY = 1440;
const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function chroniclesExteriorDaylightProfile(worldMinutes) {
  const minute = chroniclesWorldMinutes(worldMinutes) % DAY;
  const hour = minute / 60;
  const solar = chroniclesSeasonalSunTimes(worldMinutes);
  const daylight = smooth((hour - (solar.sunrise - 1)) / 2)
    * (1 - smooth((hour - (solar.sunset - 1)) / 2));
  const twilight = clamp01(
    Math.exp(-(((hour - solar.sunrise) / 1.1) ** 2))
    + Math.exp(-(((hour - solar.sunset) / 1.1) ** 2)),
  );
  // Solar disc crosses the horizon at the actual seasonal sunrise/sunset;
  // noon stays overhead, and nights remain softly lit and playable.
  const angle = (hour - solar.sunrise) * Math.PI / solar.daylightHours;
  const altitude = Math.sin(angle);
  const azimuth = -Math.cos(angle);
  const sun = new THREE.Vector3(azimuth * 0.88, altitude * 0.93, -0.27).normalize();
  return Object.freeze({
    minute,
    daylight,
    twilight,
    sun: Object.freeze({ x: sun.x, y: sun.y, z: sun.z }),
    sunVisible: altitude > 0.03,
  });
}

// Updates existing lights and sky vertices only when the game-world minute
// changes. No timers, new light sources, new shadow maps or runtime assets.
// A dungeon lacks the outdoor dome+sun pair and is intentionally ignored.
export function createChroniclesExteriorDaylight(scene, renderer, region = {}) {
  const dome = scene?.getObjectByName?.('swordhaven-sky-dome');
  const sun = scene?.getObjectByName?.('chronicles-campaign-sun');
  const skyColors = dome?.geometry?.getAttribute?.('color');
  if (!dome || !sun?.isDirectionalLight || !skyColors) return null;
  const hemi = scene.children.find((node) => node.isHemisphereLight) || null;
  const backgroundDay = scene.background?.isColor ? scene.background.clone() : null;
  const fogDay = scene.fog?.color?.clone?.() || null;
  const fogNear = scene.fog?.isFog ? scene.fog.near : null;
  const fogFar = scene.fog?.isFog ? scene.fog.far : null;
  const hemiBase = hemi?.intensity ?? 0;
  const sunBase = sun.intensity;
  const exposureDay = Number.isFinite(renderer?.toneMappingExposure)
    ? renderer.toneMappingExposure : null;
  const pos = dome.geometry.getAttribute('position');
  const direction = new THREE.Vector3();
  const sunVector = new THREE.Vector3();
  const color = new THREE.Color();
  const zenithDay = new THREE.Color(0x65a6d0);
  const horizonDay = new THREE.Color(0xb8dce9);
  const zenithNight = new THREE.Color(0x09152b);
  const horizonNight = new THREE.Color(0x263b56);
  const warm = new THREE.Color(0xffcb97);
  const blendedHorizon = new THREE.Color();
  const blendedZenith = new THREE.Color();
  const sunColorDay = new THREE.Color(0xffe6ba);
  const moonColor = new THREE.Color(0x92b3d8);
  const nightFog = new THREE.Color(0x1d2b43);
  const weatherSky = new THREE.Color(0x74838e);
  const weatherFog = new THREE.Color(0x75858a);
  const face = new THREE.Quaternion();
  const forward = new THREE.Vector3(0, 0, 1);
  const halo = dome.getObjectByName('swordhaven-sun-halo');
  const disc = dome.getObjectByName('swordhaven-sun-disc');
  const townWindowGlows = scene.getObjectByName('chronicles-town-street-window-night-glow');
  const townLanternGlass = scene.getObjectByName('chronicles-town-wall-lantern-glass');
  const lanternDayIntensity = townLanternGlass?.material?.emissiveIntensity ?? null;
  // Scan once on scene creation, not once per tick. Only authored merchant
  // plaques have torch flames; wild exteriors and dungeons stay untouched.
  const firelitShopSigns = [];
  scene.traverse((object) => {
    if (object.name !== 'swordhaven-shop-nameplate') return;
    const lettering = object.getObjectByName('shop-nameplate-lettering');
    const flames = object.getObjectByName('shop-sign-torch-flames');
    const wash = object.getObjectByName('shop-sign-torch-wallwash');
    if (lettering?.material?.isMeshStandardMaterial && flames) {
      firelitShopSigns.push({ lettering, flames, wash });
    }
  });
  const rainPuddles = scene.getObjectByName('chronicles-town-rain-puddles');
  const pavedRoad = rainPuddles ? scene.getObjectByName('chronicles-campaign-road') : null;
  const dryRoadColor = pavedRoad?.material?.color?.clone() || null;
  const dryRoadRoughness = pavedRoad?.material?.roughness ?? 1;
  const dryRoadMetalness = pavedRoad?.material?.metalness ?? 0;
  const dampStone = new THREE.Color(0x88979d);
  let lastElapsedMinute = null;

  return {
    sync(worldMinutes) {
      const elapsed = chroniclesWorldMinutes(worldMinutes);
      if (elapsed === lastElapsedMinute) return false;
      lastElapsedMinute = elapsed;
      const profile = chroniclesExteriorDaylightProfile(elapsed);
      const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: elapsed });
      const cloudiness = weather?.clouds ?? 0;
      const fogStrength = weather?.fog ?? 0;
      const { daylight, twilight, sunVisible } = profile;
      sunVector.set(profile.sun.x, profile.sun.y, profile.sun.z);
      // Never light walls from below. At night, the same shadowless-looking
      // key is a faint, cool lunar fill from above the horizon.
      if (sunVisible) sun.position.copy(sunVector).multiplyScalar(75);
      else sun.position.set(33, 48, 22);
      sun.intensity = sunBase * (0.20 + 0.80 * daylight) * (1 - cloudiness * 0.48);
      sun.color.copy(moonColor).lerp(sunColorDay, daylight);
      if (hemi) {
        hemi.intensity = hemiBase * (0.46 + 0.54 * daylight) * (1 - cloudiness * 0.15);
      }
      // Only the authored urban fixtures participate. Dungeons and wild
      // biomes have no such batches, so remain exactly as before.
      if (townWindowGlows) {
        const opacity = (1 - daylight) * 0.82;
        townWindowGlows.material.opacity = opacity;
        townWindowGlows.visible = opacity > 0.01;
      }
      if (lanternDayIntensity !== null) {
        townLanternGlass.material.emissiveIntensity =
          lanternDayIntensity + (1 - daylight) * 1.7;
      }
      const torchlight = 1 - daylight;
      for (const { lettering, flames, wash } of firelitShopSigns) {
        // Painted lettering and a soft, radial masonry wash pick up the
        // sheltered braziers at night. Rain cannot extinguish an awning-
        // protected flame. No timers or additional lights are introduced.
        lettering.material.emissiveIntensity = torchlight * 0.28;
        flames.visible = torchlight > 0.02;
        flames.userData.outerFire.opacity = torchlight * 0.94;
        flames.userData.innerFire.opacity = torchlight * 0.80;
        if (wash) {
          wash.visible = torchlight > 0.02;
          wash.material.opacity = torchlight * 0.56;
        }
      }
      if (rainPuddles && pavedRoad && dryRoadColor) {
        // Wet paving remembers recent rain across the shorter weather
        // blocks. No timers, new lights or persistence migration.
        const wet = chroniclesTownRainWetness({ ...region, worldMinutes: elapsed });
        pavedRoad.material.color.copy(dryRoadColor).lerp(dampStone, wet * 0.58);
        pavedRoad.material.roughness = THREE.MathUtils.lerp(dryRoadRoughness, 0.43, wet);
        pavedRoad.material.metalness = THREE.MathUtils.lerp(dryRoadMetalness, 0.14, wet);
        rainPuddles.material.opacity = wet * 0.76;
        rainPuddles.visible = wet > 0.025;
      }
      if (exposureDay !== null) {
        // Gentle, visible night; never an opaque black viewport.
        renderer.toneMappingExposure = exposureDay * (0.92 + 0.08 * daylight);
      }
      if (backgroundDay) scene.background.copy(backgroundDay).lerp(nightFog, 1 - daylight);
      if (fogDay) scene.fog.color.copy(fogDay).lerp(nightFog, 1 - daylight)
        .lerp(weatherFog, fogStrength * (0.32 + 0.68 * daylight));
      if (fogNear !== null && fogFar !== null) {
        // At most halve draw distance; never hide the next few playable cells.
        scene.fog.near = Math.max(8, fogNear * (1 - fogStrength * 0.55));
        scene.fog.far = Math.max(45, fogFar * (1 - fogStrength * 0.55));
      }
      blendedHorizon.copy(horizonNight).lerp(horizonDay, daylight)
        .lerp(weatherSky, cloudiness * 0.55);
      blendedZenith.copy(zenithNight).lerp(zenithDay, daylight)
        .lerp(weatherSky, cloudiness * 0.72);
      for (let i = 0; i < pos.count; i += 1) {
        direction.fromBufferAttribute(pos, i).normalize();
        const altitude = THREE.MathUtils.smoothstep(direction.y, -0.08, 0.75);
        // The horizon warms briefly at sunset/sunrise rather than turning
        // the entire sky orange. Midday retains the original blue gradient.
        const glow = Math.pow(Math.max(0, direction.dot(sunVector)), 30) * 0.54;
        color.copy(blendedHorizon).lerp(blendedZenith, altitude);
        color.lerp(warm, clamp01(glow * daylight + twilight * (1 - altitude) * 0.32));
        skyColors.setXYZ(i, color.r, color.g, color.b);
      }
      skyColors.needsUpdate = true;
      face.setFromUnitVectors(forward, sunVector);
      for (const ornament of [disc, halo]) {
        if (!ornament) continue;
        ornament.visible = sunVisible && cloudiness < 0.8;
        ornament.quaternion.copy(face);
        ornament.position.copy(sunVector).multiplyScalar(
          ornament === disc ? 57.5 : 59,
        );
      }
      return true;
    },
  };
}
