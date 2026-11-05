import * as THREE from 'three';
import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// A deterministic 24-hour outdoor light profile. The 05–07 and 18–20
// transitions are gradual, and use the exact same minutes as I/Information.
const DAY = 1440;
const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function chroniclesExteriorDaylightProfile(worldMinutes) {
  const minute = chroniclesWorldMinutes(worldMinutes) % DAY;
  const hour = minute / 60;
  const daylight = smooth((hour - 5) / 2) * (1 - smooth((hour - 18) / 2));
  const twilight = clamp01(
    Math.exp(-((hour - 6.2) / 1.1) ** 2)
    + Math.exp(-((hour - 18.9) / 1.1) ** 2),
  );
  // Rise in the east at 06:00, peak at midday and set in the west at 18:00.
  // Keep the disc below the horizon when it should be invisible.
  const angle = (hour - 6) * Math.PI / 12;
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
export function createChroniclesExteriorDaylight(scene, renderer) {
  const dome = scene?.getObjectByName?.('swordhaven-sky-dome');
  const sun = scene?.getObjectByName?.('chronicles-campaign-sun');
  const skyColors = dome?.geometry?.getAttribute?.('color');
  if (!dome || !sun?.isDirectionalLight || !skyColors) return null;
  const hemi = scene.children.find((node) => node.isHemisphereLight) || null;
  const backgroundDay = scene.background?.isColor ? scene.background.clone() : null;
  const fogDay = scene.fog?.color?.clone?.() || null;
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
  const sunColorDay = new THREE.Color(0xffe6ba);
  const moonColor = new THREE.Color(0x92b3d8);
  const nightFog = new THREE.Color(0x1d2b43);
  const face = new THREE.Quaternion();
  const forward = new THREE.Vector3(0, 0, 1);
  const halo = dome.getObjectByName('swordhaven-sun-halo');
  const disc = dome.getObjectByName('swordhaven-sun-disc');
  let lastMinute = null;

  return {
    sync(worldMinutes) {
      const profile = chroniclesExteriorDaylightProfile(worldMinutes);
      if (profile.minute === lastMinute) return false;
      lastMinute = profile.minute;
      const { daylight, twilight, sunVisible } = profile;
      sunVector.set(profile.sun.x, profile.sun.y, profile.sun.z);
      // Never light walls from below. At night, the same shadowless-looking
      // key is a faint, cool lunar fill from above the horizon.
      if (sunVisible) sun.position.copy(sunVector).multiplyScalar(75);
      else sun.position.set(33, 48, 22);
      sun.intensity = sunBase * (0.20 + 0.80 * daylight);
      sun.color.copy(moonColor).lerp(sunColorDay, daylight);
      if (hemi) {
        hemi.intensity = hemiBase * (0.46 + 0.54 * daylight);
      }
      if (exposureDay !== null) {
        // Gentle, visible night; never an opaque black viewport.
        renderer.toneMappingExposure = exposureDay * (0.92 + 0.08 * daylight);
      }
      if (backgroundDay) scene.background.copy(backgroundDay).lerp(nightFog, 1 - daylight);
      if (fogDay) scene.fog.color.copy(fogDay).lerp(nightFog, 1 - daylight);
      for (let i = 0; i < pos.count; i += 1) {
        direction.fromBufferAttribute(pos, i).normalize();
        const altitude = THREE.MathUtils.smoothstep(direction.y, -0.08, 0.75);
        // The horizon warms briefly at sunset/sunrise rather than turning
        // the entire sky orange. Midday retains the original blue gradient.
        const glow = Math.pow(Math.max(0, direction.dot(sunVector)), 30) * 0.54;
        color.copy(horizonNight).lerp(horizonDay, daylight)
          .lerp(zenithNight.clone().lerp(zenithDay, daylight), altitude);
        color.lerp(warm, clamp01(glow * daylight + twilight * (1 - altitude) * 0.32));
        skyColors.setXYZ(i, color.r, color.g, color.b);
      }
      skyColors.needsUpdate = true;
      face.setFromUnitVectors(forward, sunVector);
      for (const ornament of [disc, halo]) {
        if (!ornament) continue;
        ornament.visible = sunVisible;
        ornament.quaternion.copy(face);
        ornament.position.copy(sunVector).multiplyScalar(
          ornament === disc ? 57.5 : 59,
        );
      }
      return true;
    },
  };
}
