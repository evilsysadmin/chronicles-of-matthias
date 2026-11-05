import * as THREE from 'three';
import {
  CHRONICLES_WEATHER_PERIOD_MINUTES, chroniclesRegionalWeather,
} from './chroniclesRegionalWeather.js';
import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// Swordhaven's wetness is derived from the real saved Terra minutes, not a
// simulation tick. Thirty minutes to soak through rain, three hours to dry.
export function chroniclesTownRainWetness({ worldMinutes, ...region } = {}) {
  if (region.mapId !== 'swordhaven-first-book' || region.regionKind !== 'settlement') return 0;
  const elapsed = chroniclesWorldMinutes(worldMinutes);
  const offset = elapsed % CHRONICLES_WEATHER_PERIOD_MINUTES;
  const start = elapsed - offset;
  const current = chroniclesRegionalWeather({ ...region, worldMinutes: elapsed });
  // Shorter 90-minute climate cells must not shorten the existing 3-hour
  // drying time. Inspect at most the last two 90-minute boundaries and
  // remember when the most recent rain finished, without new save fields.
  let residual = 0;
  for (let boundary = start; boundary > 0 && elapsed - boundary < 180;
    boundary -= CHRONICLES_WEATHER_PERIOD_MINUTES) {
    const before = chroniclesRegionalWeather({ ...region, worldMinutes: boundary - 1 });
    if (before?.kind === 'rain') {
      residual = Math.max(0, 1 - (elapsed - boundary) / 180);
      break;
    }
  }
  // An intermittent shower re-wets still-damp cobbles instead of resetting
  // them to dry at a new weather boundary.
  return current?.kind === 'rain' ? Math.max(residual, Math.min(1, offset / 30)) : residual;
}

// Puddles belong entirely to existing walkable, authored road tiles. Sparse,
// coordinate-based selection means reloading a campaign yields the same pools.
export function chroniclesTownRainPuddleCells(roadCells, coarsePointer = false) {
  const limit = coarsePointer ? 12 : 22;
  return (Array.isArray(roadCells) ? roadCells : [])
    .filter(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)
      && (Math.imul(x + 7, 31) + Math.imul(y + 11, 17)) % 7 === 0)
    .slice(0, limit);
}

function puddleTexture() {
  // Single, tiny alpha-faded texture. The deep centre reads as standing water
  // and softened edges avoid round sticker-like circles on the cobblestones.
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5 - size / 2) / (size / 2);
      const v = (y + 0.5 - size / 2) / (size / 2);
      const radius = Math.sqrt(u * u + v * v);
      const fade = Math.pow(Math.max(0, 1 - radius), 0.83);
      const glint = Math.max(0, 1 - Math.abs(v + 0.36) * 13)
        * Math.max(0, 1 - Math.abs(u + 0.25) * 1.7) * 0.23;
      const i = (y * size + x) * 4;
      data[i] = Math.round(112 + glint * 84);
      data[i + 1] = Math.round(139 + glint * 71);
      data[i + 2] = Math.round(158 + glint * 66);
      data[i + 3] = Math.round(210 * fade);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'chronicles-town-rain-puddle-alpha';
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createChroniclesTownRainPuddles({ roadCells, sceneCenter, coarsePointer = false, gridToWorld } = {}) {
  const cells = chroniclesTownRainPuddleCells(roadCells, coarsePointer);
  if (!cells.length) return null;
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    map: puddleTexture(), color: 0xb8c8d3,
    transparent: true, opacity: 0, depthWrite: false,
    roughness: 0.24, metalness: 0.12, side: THREE.DoubleSide,
  });
  const batch = new THREE.InstancedMesh(geometry, material, cells.length);
  const dummy = new THREE.Object3D();
  cells.forEach(({ x, y }, index) => {
    const [wx, wz] = gridToWorld(x, y, sceneCenter);
    const seed = (Math.imul(x + 23, 19) ^ Math.imul(y + 11, 29)) >>> 0;
    dummy.position.set(wx + ((seed % 5) - 2) * 0.16, 0.033, wz + (((seed >>> 3) % 5) - 2) * 0.15);
    dummy.rotation.set(0, (seed % 11) * 0.23, 0);
    dummy.scale.set(0.85 + (seed % 4) * 0.13, 1, 0.48 + ((seed >>> 4) % 4) * 0.11);
    dummy.updateMatrix();
    batch.setMatrixAt(index, dummy.matrix);
  });
  batch.instanceMatrix.needsUpdate = true;
  batch.name = 'chronicles-town-rain-puddles';
  batch.visible = false;
  batch.castShadow = false;
  batch.receiveShadow = false;
  batch.frustumCulled = false; // Instances are spread through the authored town.
  batch.userData.chroniclesDecorativeOnly = true;
  return batch;
}
