import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createChroniclesSkyCloudPanorama } from './chroniclesSkyCloudPanorama.js';
import { createSwordhavenSkyDome } from './chroniclesSwordhaven3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';
import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';

describe('Seamless Terra cloud panorama', () => {
  it.each([
    [false, 512, 192],
    [true, 256, 96],
  ])('spans all headings with one low-cost tiled sky layer (coarse=%s)', (coarse, width, height) => {
    const cloud = createChroniclesSkyCloudPanorama(coarse);
    expect(cloud).toBeInstanceOf(THREE.Mesh);
    expect(cloud.name).toBe('chronicles-sky-cloud-panorama');
    expect(cloud.userData.chroniclesDecorativeOnly).toBe(true);
    expect(cloud.castShadow).toBe(false);
    expect(cloud.receiveShadow).toBe(false);
    expect(cloud.frustumCulled).toBe(false);
    expect(cloud.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(cloud.material.transparent).toBe(true);
    expect(cloud.material.depthWrite).toBe(false);
    expect(cloud.material.fog).toBe(false);
    expect(cloud.material.map).toBeInstanceOf(THREE.DataTexture);
    const texture = cloud.material.map;
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.image.width).toBe(width);
    expect(texture.image.height).toBe(height);
    const pixels = texture.image.data;
    const px = (x, y, channel) => pixels[(y * width + x) * 4 + channel];
    // Identical seam pixels, including alpha and RGB, with nonzero cloud
    // coverage across every heading even at the back of the town.
    for (let y = 0; y < height; y += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        expect(px(0, y, channel)).toBe(px(width - 1, y, channel));
      }
    }
    const bandY = Math.round(height * 0.64);
    expect(Array.from({ length: 12 }, (_, index) =>
      px(Math.floor(index * (width - 1) / 12), bandY, 3)).every(a => a > 24)).toBe(true);
    expect(px(Math.floor(width / 2), 0, 3)).toBe(0);
    expect(px(Math.floor(width / 2), height - 1, 3)).toBe(0);
    const atmosphere = Array.from({ length: 12 }, (_, index) =>
      px(Math.floor(index * (width - 1) / 12), Math.round(height * 0.53), 3));
    expect(atmosphere.some(a => a > 0)).toBe(true);
    expect(new Set(Array.from({ length: 12 }, (_, index) =>
      px(Math.floor(index * (width - 1) / 12), bandY, 0))).size).toBeGreaterThan(5);
    cloud.geometry.dispose();
    texture.dispose();
    cloud.material.dispose();
  });

  it('stays centred on a moving camera without rotating with player yaw', () => {
    const dome = createSwordhavenSkyDome(new THREE.Vector3(-25, 30, -65).normalize(), true);
    const cloud = dome.getObjectByName('chronicles-sky-cloud-panorama');
    expect(cloud).toBeTruthy();
    expect(cloud.parent).toBe(dome);
    expect(dome.children.filter(child => child.name === cloud.name)).toHaveLength(1);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(16, 1.8, -22);
    camera.rotation.y = 1.2;
    dome.onBeforeRender(null, null, camera);
    expect(cloud.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position)).toBeLessThan(1e-5);
    expect(cloud.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()))
      .toBeLessThan(1e-5);
    camera.position.set(-41, 2.4, 3);
    camera.rotation.y = Math.PI;
    dome.onBeforeRender(null, null, camera);
    expect(cloud.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position)).toBeLessThan(1e-5);
    expect(cloud.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()))
      .toBeLessThan(1e-5);
  });

  it('matches persisted clear/rain transitions and reverses on restoring a save', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb4d4df);
    scene.fog = new THREE.Fog(0xb4d4df, 55, 140);
    const dome = createSwordhavenSkyDome(new THREE.Vector3(-25, 30, -65).normalize(), true);
    scene.add(dome);
    const sun = new THREE.DirectionalLight(0xffe6ba, 1.88);
    sun.name = 'chronicles-campaign-sun';
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd4e9ff, 0x60734b, 1.12));
    const material = dome.getObjectByName('chronicles-sky-cloud-panorama').material;
    const region = { mapId: 'swordhaven-first-book', regionKind: 'settlement' };
    const times = Array.from({ length: 160 }, (_, day) => day * 1440 + 12 * 60 + 45);
    const weatherAt = (t) => chroniclesRegionalWeather({ ...region, worldMinutes: t })?.kind;
    const clear = times.find(t => weatherAt(t) === 'clear');
    const rain = times.find(t => weatherAt(t) === 'rain');
    expect(clear).toBeDefined();
    expect(rain).toBeDefined();
    const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1.08 }, region);
    const objectCount = scene.children.length;
    cycle.sync(clear);
    const clearOpacity = material.opacity;
    const clearColor = material.color.clone();
    expect(cycle.sync(clear)).toBe(false);
    cycle.sync(rain);
    expect(material.opacity).toBeGreaterThan(clearOpacity);
    expect(material.color.equals(clearColor)).toBe(false);
    cycle.sync(clear);
    expect(material.opacity).toBeCloseTo(clearOpacity);
    expect(material.color.equals(clearColor)).toBe(true);
    expect(scene.children.length).toBe(objectCount);
  });
});
