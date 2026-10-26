import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesIsometricScenePlan } from './chronicles/chroniclesIsometricScenePlan.js';
import { CHRONICLES_MINIMUM_VISIBILITY } from './chronicles/chroniclesLightingPolicy.js';
import { chroniclesMapById } from './chronicles/chroniclesMapCatalog.js';
import { buildChroniclesDungeonAtmosphere } from './chroniclesOfMatthiasAtmosphere.js';

describe('Chronicles of Matthias dungeon atmosphere', () => {
  it('keeps the desktop atmosphere richer than the coarse-pointer budget', () => {
    const desktop = buildChroniclesDungeonAtmosphere();
    const coarse = buildChroniclesDungeonAtmosphere({ coarsePointer: true });

    expect(desktop.userData.chroniclesAtmosphereStats).toEqual({ dustCount: 84, mistCount: 3, readabilityLightCount: 8 });
    expect(coarse.userData.chroniclesAtmosphereStats).toEqual({ dustCount: 24, mistCount: 0, readabilityLightCount: 8 });
    expect(desktop.getObjectByName('chronicles-gate-mist')).toBeTruthy();
    expect(desktop.getObjectByName('chronicles-surface-patina')).toBeTruthy();
    expect(coarse.getObjectByName('chronicles-surface-patina')).toBeTruthy();
    expect(coarse.getObjectByName('chronicles-gate-mist')).toBeFalsy();
  });

  it('shares the active scene topology between ceiling and deterministic dust', () => {
    const scenePlan = chroniclesIsometricScenePlan(chroniclesMapById('gallery-of-forks'));
    const atmosphere = buildChroniclesDungeonAtmosphere({ scenePlan });
    const dustPositions = atmosphere
      .getObjectByName('chronicles-dungeon-dust')
      .geometry
      .getAttribute('position');
    const slabCenters = scenePlan.floors.map((_, index) => {
      const slab = atmosphere.getObjectByName(`chronicles-ceiling-slab-${index}`);
      expect(slab).toBeTruthy();
      return { x: slab.position.x, z: slab.position.z };
    });

    expect(slabCenters).toHaveLength(scenePlan.floors.length);
    for (let index = 0; index < dustPositions.count; index += 1) {
      const x = dustPositions.getX(index);
      const z = dustPositions.getZ(index);
      expect(slabCenters.some((center) => (
        Math.abs(x - center.x) <= 1.53 && Math.abs(z - center.z) <= 1.53
      ))).toBe(true);
    }
  });

  it('adds layered non-shadowing bounce light so authored stone remains readable', () => {
    const desktop = buildChroniclesDungeonAtmosphere();
    const ambient = desktop.getObjectByName('chronicles-readability-ambient');
    const entryBounce = desktop.getObjectByName('chronicles-readability-entry-bounce');
    const cryptBounce = desktop.getObjectByName('chronicles-readability-crypt-bounce');
    const floorBounce = desktop.getObjectByName('chronicles-readability-floor-bounce');
    const corridorFill = desktop.getObjectByName('chronicles-readability-corridor-fill');
    const farFill = desktop.getObjectByName('chronicles-readability-far-fill');

    expect(ambient?.isAmbientLight).toBe(true);
    expect(ambient?.intensity).toBeGreaterThanOrEqual(CHRONICLES_MINIMUM_VISIBILITY.firstPerson.ambientDesktop);
    expect(entryBounce?.isPointLight).toBe(true);
    expect(cryptBounce?.isPointLight).toBe(true);
    expect(floorBounce?.isPointLight).toBe(true);
    expect(corridorFill?.isPointLight).toBe(true);
    expect(farFill?.isPointLight).toBe(true);
    expect(entryBounce?.castShadow).toBe(false);
    expect(cryptBounce?.castShadow).toBe(false);
    expect(floorBounce?.castShadow).toBe(false);
    expect(corridorFill?.castShadow).toBe(false);
    expect(farFill?.castShadow).toBe(false);
    expect(entryBounce?.distance).toBeLessThanOrEqual(14);
    expect(cryptBounce?.distance).toBeLessThanOrEqual(17);
    expect(floorBounce?.position.y).toBeLessThan(0.5);
    expect(floorBounce?.distance).toBeLessThanOrEqual(11);
    expect(floorBounce?.decay).toBeGreaterThan(2);
    expect(corridorFill?.distance).toBeGreaterThanOrEqual(18);
    expect(corridorFill?.decay).toBeLessThan(2);
    expect(farFill?.intensity).toBeLessThan(corridorFill?.intensity);
  });

  it('dims the authored crypt lighting profile without removing local readability lights', () => {
    const defaultAtmosphere = buildChroniclesDungeonAtmosphere({
      scenePlan: { materials: { lightingProfile: 'default' }, floors: [{ x: 1, y: 1 }], center: { x: 1, y: 1 } },
    });
    const darkAtmosphere = buildChroniclesDungeonAtmosphere({
      scenePlan: { materials: { lightingProfile: 'crypt-dark' }, floors: [{ x: 1, y: 1 }], center: { x: 1, y: 1 } },
    });

    const defaultAmbient = defaultAtmosphere.getObjectByName('chronicles-readability-ambient');
    const darkAmbient = darkAtmosphere.getObjectByName('chronicles-readability-ambient');
    const defaultCorridor = defaultAtmosphere.getObjectByName('chronicles-readability-corridor-fill');
    const darkCorridor = darkAtmosphere.getObjectByName('chronicles-readability-corridor-fill');
    const darkTorch = darkAtmosphere.getObjectByName('chronicles-party-torch-key');

    expect(darkAtmosphere.userData.chroniclesLightingProfile).toBe('crypt-dark');
    expect(darkAmbient?.intensity).toBeLessThanOrEqual(defaultAmbient?.intensity || Infinity);
    expect(darkCorridor?.intensity).toBeLessThan(defaultCorridor?.intensity || Infinity);
    expect(darkTorch?.intensity).toBeGreaterThan(4);
  });

  it('carries a warm torch with the party camera instead of relying on wall lights', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 70);
    camera.position.set(-8, 1.62, 8);
    camera.rotation.y = -Math.PI / 2;
    const atmosphere = buildChroniclesDungeonAtmosphere();
    scene.add(camera, atmosphere);

    const key = atmosphere.getObjectByName('chronicles-party-torch-key');
    const bounce = atmosphere.getObjectByName('chronicles-party-torch-bounce');
    atmosphere.userData.updateChroniclesAtmosphere(1.4);

    expect(key?.isPointLight).toBe(true);
    expect(bounce?.isPointLight).toBe(true);
    expect(key?.castShadow).toBe(false);
    expect(bounce?.castShadow).toBe(false);
    expect(key?.intensity).toBeGreaterThan(4.5);
    expect(key?.distance).toBeLessThanOrEqual(13);
    expect(key?.position.distanceTo(camera.position)).toBeLessThan(1.2);
    expect(bounce?.intensity).toBeGreaterThan(2.6);
    expect(bounce?.position.y).toBeGreaterThan(0.8);
    expect(bounce?.position.y).toBeLessThan(1.3);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const bounceOffset = bounce.position.clone().sub(camera.position);
    expect(bounceOffset.dot(forward)).toBeGreaterThan(0.5);

    const before = key.position.clone();
    camera.position.set(-4, 1.62, 8);
    camera.rotation.y = 0;
    atmosphere.userData.updateChroniclesAtmosphere(2.1);
    expect(key.position.distanceTo(before)).toBeGreaterThan(3.5);
    expect(key.position.distanceTo(camera.position)).toBeLessThan(1.2);
  });

  it('keeps the current party tile bright even in the dark crypt mobile profile', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 70);
    camera.position.set(8, 1.62, -4);
    camera.rotation.y = Math.PI / 2;
    const atmosphere = buildChroniclesDungeonAtmosphere({
      coarsePointer: true,
      reducedMotion: true,
      scenePlan: {
        materials: { lightingProfile: 'crypt-dark' },
        floors: [{ x: 1, y: 1 }],
        center: { x: 1, y: 1 },
      },
    });
    scene.add(camera, atmosphere);
    atmosphere.userData.updateChroniclesAtmosphere(1);
    const key = atmosphere.getObjectByName('chronicles-party-torch-key');
    const bounce = atmosphere.getObjectByName('chronicles-party-torch-bounce');

    expect(key.intensity).toBeGreaterThan(10);
    expect(bounce.intensity).toBeGreaterThan(7);
    expect(key.distance).toBeLessThanOrEqual(13);
    expect(bounce.distance).toBeLessThanOrEqual(8);
    // This ground spill is directly beneath/just ahead of the party, never at
    // a fixed authored tile or a point light buried at floor height.
    expect(bounce.position.y).toBeGreaterThan(0.8);
    expect(bounce.position.y).toBeLessThan(1.3);
    expect(Math.hypot(bounce.position.x - camera.position.x, bounce.position.z - camera.position.z))
      .toBeLessThan(1);
    const start = bounce.position.clone();
    camera.position.set(-4, 1.62, 4);
    camera.rotation.y = 0;
    atmosphere.userData.updateChroniclesAtmosphere(8);
    expect(bounce.position.distanceTo(start)).toBeGreaterThan(10);
    expect(Math.hypot(bounce.position.x - camera.position.x, bounce.position.z - camera.position.z))
      .toBeLessThan(1);
  });

  it('keeps the carried torch attached when reduced motion disables flicker', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 70);
    camera.position.set(0, 1.62, 8);
    const atmosphere = buildChroniclesDungeonAtmosphere({ reducedMotion: true });
    scene.add(camera, atmosphere);
    const key = atmosphere.getObjectByName('chronicles-party-torch-key');

    atmosphere.userData.updateChroniclesAtmosphere(1);
    const intensity = key.intensity;
    camera.position.z = 4;
    atmosphere.userData.updateChroniclesAtmosphere(9);

    expect(key.intensity).toBe(intensity);
    expect(key.position.distanceTo(camera.position)).toBeLessThan(1.2);
  });

  it('generates deterministic dust only across the authored dungeon volume', () => {
    const first = buildChroniclesDungeonAtmosphere();
    const second = buildChroniclesDungeonAtmosphere();
    const firstPositions = first.getObjectByName('chronicles-dungeon-dust').geometry.getAttribute('position');
    const secondPositions = second.getObjectByName('chronicles-dungeon-dust').geometry.getAttribute('position');

    expect(firstPositions.count).toBe(84);
    expect([...firstPositions.array.slice(0, 18)]).toEqual([...secondPositions.array.slice(0, 18)]);
    for (let index = 0; index < firstPositions.count; index += 1) {
      expect(firstPositions.getY(index)).toBeGreaterThan(0.3);
      expect(firstPositions.getY(index)).toBeLessThan(3.2);
    }
  });

  it('animates dust subtly but stays static when reduced motion is requested', () => {
    const animated = buildChroniclesDungeonAtmosphere();
    const still = buildChroniclesDungeonAtmosphere({ reducedMotion: true });
    const animatedPosition = animated.getObjectByName('chronicles-dungeon-dust').geometry.getAttribute('position');
    const stillPosition = still.getObjectByName('chronicles-dungeon-dust').geometry.getAttribute('position');
    const animatedBefore = animatedPosition.getY(0);
    const stillBefore = stillPosition.getY(0);

    animated.userData.updateChroniclesAtmosphere(4.2);
    still.userData.updateChroniclesAtmosphere(4.2);

    expect(animatedPosition.getY(0)).not.toBe(animatedBefore);
    expect(stillPosition.getY(0)).toBe(stillBefore);
  });
  it('keeps cool fill stable through a full turn at a real sewer junction', () => {
    const map = chroniclesMapById('swordhaven-sewers');
    const scenePlan = {
      ...chroniclesIsometricScenePlan(map),
      grid: map.grid,
      useAuthoredCryptDressing: false,
    };
    // A genuine T-junction: west, east and south are traversable, north is
    // solid. Previously the forward cool light jumped between a wall and a
    // corridor as the camera yaw passed diagonals.
    expect(map.grid[1][2]).not.toBe('#');
    expect(map.grid[1][1]).not.toBe('#');
    expect(map.grid[1][3]).not.toBe('#');
    expect(map.grid[2][2]).not.toBe('#');
    expect(map.grid[0][2]).toBe('#');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 70);
    camera.position.set(
      (2 - scenePlan.center.x) * 4, 1.62, (1 - scenePlan.center.y) * 4,
    );
    const atmosphere = buildChroniclesDungeonAtmosphere({
      scenePlan, reducedMotion: true,
    });
    scene.add(camera, atmosphere);
    const fill = atmosphere.getObjectByName('chronicles-readability-corridor-fill');
    const torch = atmosphere.getObjectByName('chronicles-party-torch-key');

    expect(fill?.isPointLight).toBe(true);
    expect(fill.castShadow).toBe(false);
    expect(fill.distance).toBeLessThanOrEqual(10);
    expect(fill.decay).toBeGreaterThanOrEqual(2);
    const intensity = fill.intensity;
    const torchIntensity = torch.intensity;
    for (const [index, yaw] of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI / 4].entries()) {
      camera.rotation.y = yaw;
      atmosphere.userData.updateChroniclesAtmosphere(index + 1);
      expect(fill.position.x).toBeCloseTo(camera.position.x);
      expect(fill.position.z).toBeCloseTo(camera.position.z);
      expect(fill.position.y).toBe(2.35);
      expect(fill.intensity).toBe(intensity);
      expect(torch.intensity).toBe(torchIntensity);
    }
    // The fill still follows real movement, without tracking camera yaw.
    camera.position.x += 4;
    atmosphere.userData.updateChroniclesAtmosphere(10);
    expect(fill.position.x).toBeCloseTo(camera.position.x);
    expect(fill.position.z).toBeCloseTo(camera.position.z);
    expect(fill.intensity).toBe(intensity);
  });

  it('does not relocate authored crypt lighting during a turn', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 70);
    const atmosphere = buildChroniclesDungeonAtmosphere({ reducedMotion: true });
    scene.add(camera, atmosphere);
    const fill = atmosphere.getObjectByName('chronicles-readability-corridor-fill');
    const origin = fill.position.clone();
    const intensity = fill.intensity;

    camera.rotation.y = Math.PI / 2;
    atmosphere.userData.updateChroniclesAtmosphere(1);
    camera.rotation.y = Math.PI;
    camera.position.set(4, 1.62, -4);
    atmosphere.userData.updateChroniclesAtmosphere(2);
    expect(fill.position).toEqual(origin);
    expect(fill.intensity).toBe(intensity);
  });

});
