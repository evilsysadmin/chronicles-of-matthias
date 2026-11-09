import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addSwordhavenClouds, buildSwordhavenScene, createSwordhavenSkyDome } from './chroniclesSwordhaven3D.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhavenFirstBook from './maps/swordhaven-first-book.json';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';
import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';

describe('Swordhaven storm-cloud banks', () => {
  it.each([
    [false, 8],
    [true, 4],
  ])('uses one detailed procedural atlas for every bank (coarsePointer=%s)', (coarsePointer, count) => {
    const root = new THREE.Group();
    addSwordhavenClouds(root, coarsePointer);
    expect(root.children).toHaveLength(count);
    const banks = root.children.map(cloud => {
      expect(cloud.name.startsWith('swordhaven-cloud-')).toBe(true);
      expect(cloud.userData.chroniclesDecorativeOnly).toBe(true);
      expect(cloud.position.y).toBeGreaterThan(15);
      expect(cloud.children).toHaveLength(1);
      return cloud.children[0];
    });
    expect(new Set(banks.map(bank => bank.material)).size).toBe(1);
    const material = banks[0].material;
    expect(material).toBeInstanceOf(THREE.SpriteMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    const { data, width, height } = material.map.image;
    expect([width, height]).toEqual([256, 128]);
    const pixel = (x, y, channel) => data[(y * width + x) * 4 + channel];
    expect(pixel(0, 0, 3)).toBe(0);
    expect(pixel(255, 127, 3)).toBe(0);
    expect(pixel(128, 64, 3)).toBeGreaterThan(150);
    const alphas = new Set();
    const shades = new Set();
    for (let y = 16; y < 112; y += 7) {
      for (let x = 20; x < 236; x += 7) {
        alphas.add(pixel(x, y, 3));
        shades.add(pixel(x, y, 0));
      }
    }
    expect(alphas.size).toBeGreaterThan(25);
    expect(shades.size).toBeGreaterThan(25);
    for (const bank of banks) {
      expect(bank.isSprite).toBe(true);
      expect(bank.name).toBe('cloud-soft-bank');
      expect(bank.scale.x / bank.scale.y).toBeGreaterThan(2);
      expect(bank.castShadow).toBe(false);
      expect(bank.receiveShadow).toBe(false);
      expect(bank.frustumCulled).toBe(false);
      expect(bank.userData.chroniclesDecorativeOnly).toBe(true);
    }
  });

  it.each(['legacy', 'campaign'])('keeps the %s town clouds fixed relative to the camera at every heading', (kind) => {
    const scene = new THREE.Scene();
    if (kind === 'legacy') {
      buildSwordhavenScene(scene, { coarsePointer: true });
    } else {
      const grid = swordhavenFirstBook.grid;
      buildChroniclesCampaignExterior(scene, {
        coarsePointer: true,
        scenePlan: {
          mapId: swordhavenFirstBook.id,
          regionKind: 'settlement',
          width: grid[0].length,
          height: grid.length,
          center: { x: 9, y: 7 },
          grid,
          content: [],
          landscape: swordhavenFirstBook.landscape,
        },
      });
    }
    const sky = scene.getObjectByName('swordhaven-sky-dome');
    const cloud = scene.getObjectByName('swordhaven-cloud-0');
    const panorama = sky?.getObjectByName('chronicles-sky-cloud-panorama');
    expect(sky).toBeTruthy();
    expect(panorama).toBeTruthy();
    expect(cloud.parent).toBe(sky);
    expect(cloud.position.length()).toBeLessThan(panorama.geometry.parameters.radius);
    const town = scene.getObjectByName(kind === 'legacy' ? 'chronicles-swordhaven-town' : 'chronicles-campaign-town');
    expect(town?.getObjectByName('swordhaven-cloud-0')).toBeUndefined();

    const camera = new THREE.PerspectiveCamera();
    const localOffset = cloud.position.clone();
    for (const [x, z, yaw] of [
      [0, 0, 0], [18, -22, Math.PI / 2],
      [-27, 15, Math.PI], [7, 30, Math.PI * 1.5],
    ]) {
      camera.position.set(x, 1.62, z);
      camera.rotation.y = yaw;
      sky.onBeforeRender(null, scene, camera);
      const actual = cloud.getWorldPosition(new THREE.Vector3());
      expect(actual.distanceTo(camera.position.clone().add(localOffset))).toBeLessThan(1e-5);
      expect(cloud.getWorldQuaternion(new THREE.Quaternion())
        .angleTo(new THREE.Quaternion())).toBeLessThan(1e-5);
    }
  });

  it('releases its shared procedural atlas exactly once on scene disposal', () => {
    const root = new THREE.Group();
    addSwordhavenClouds(root, true);
    const material = root.children[0].children[0].material;
    const atlas = material.map;
    let disposed = 0;
    atlas.addEventListener('dispose', () => { disposed += 1; });
    root.children.forEach(group => group.children[0].material.dispose());
    expect(disposed).toBe(1);
  });

  it('uses persisted weather and daylight to tint clouds without creating more sprites', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb4d4df);
    scene.fog = new THREE.Fog(0xb4d4df, 55, 140);
    scene.add(createSwordhavenSkyDome(new THREE.Vector3(-25, 30, -65).normalize()));
    const sun = new THREE.DirectionalLight(0xffe6ba, 1.88);
    sun.name = 'chronicles-campaign-sun';
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd4e9ff, 0x60734b, 1.12));
    const root = new THREE.Group();
    scene.add(root);
    addSwordhavenClouds(root, true);
    const material = scene.getObjectByName('swordhaven-cloud-0').children[0].material;
    const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1.08 }, {
      mapId: 'swordhaven-first-book', regionKind: 'settlement',
    });
    const search = Array.from({ length: 160 }, (_, i) => i * 1440 + 12 * 60);
    const clear = search.find(t => chroniclesRegionalWeather({
      mapId: 'swordhaven-first-book', regionKind: 'settlement', worldMinutes: t,
    })?.kind === 'clear');
    const rainy = search.find(t => chroniclesRegionalWeather({
      mapId: 'swordhaven-first-book', regionKind: 'settlement', worldMinutes: t,
    })?.kind === 'rain');
    expect(clear).toBeDefined();
    expect(rainy).toBeDefined();
    const count = root.children.length;
    cycle.sync(clear);
    const clearOpacity = material.opacity;
    const clearColor = material.color.clone();
    cycle.sync(rainy);
    expect(material.opacity).toBeGreaterThan(clearOpacity);
    expect(material.color.equals(clearColor)).toBe(false);
    expect(root.children).toHaveLength(count);
    cycle.sync(clear);
    expect(material.opacity).toBeCloseTo(clearOpacity);
    expect(material.color.equals(clearColor)).toBe(true);
  });
});
