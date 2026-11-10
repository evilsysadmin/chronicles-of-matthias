import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createChroniclesSkyCloudPanorama } from './chroniclesSkyCloudPanorama.js';
import { addSwordhavenClouds, createSwordhavenSkyDome } from './chroniclesSwordhaven3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';
import { chroniclesRegionalWeather, chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';

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
    // High-altitude clouds must have separated wisps instead of stopping at
    // one ruler-straight horizon stripe. Both GPU budgets use the same shape.
    const elevatedY = Math.round(height * 0.88);
    const elevated = Array.from({ length: 12 }, (_, index) =>
      px(Math.floor(index * (width - 1) / 12), elevatedY, 3));
    expect(elevated.some(alpha => alpha >= 55)).toBe(true);
    expect(elevated.some(alpha => alpha <= 20)).toBe(true);
    expect(new Set(elevated).size).toBeGreaterThan(6);
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

  it('fades the low skyline into actual regional fog, preserving higher clouds and rewind', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb4d4df);
    scene.fog = new THREE.Fog(0xb4d4df, 55, 140);
    const dome = createSwordhavenSkyDome(new THREE.Vector3(-25, 30, -65).normalize(), true);
    scene.add(dome);
    addSwordhavenClouds(dome, true);
    const sun = new THREE.DirectionalLight(0xffe6ba, 1.88);
    sun.name = 'chronicles-campaign-sun';
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd4e9ff, 0x60734b, 1.12));
    const panorama = dome.getObjectByName('chronicles-sky-cloud-panorama').material;
    const foreground = dome.getObjectByName('swordhaven-cloud-0')
      .getObjectByName('cloud-soft-bank').material;
    const colors = dome.geometry.getAttribute('color');
    const positions = dome.geometry.getAttribute('position');
    const horizonIndex = Array.from({ length: positions.count }, (_, i) => i)
      .find(i => Math.abs(positions.getY(i)) < 0.001);
    const topIndex = Array.from({ length: positions.count }, (_, i) => i)
      .find(i => positions.getY(i) > 61.9);
    const sample = (index) => new THREE.Color(
      colors.getX(index), colors.getY(index), colors.getZ(index));
    const colorDistance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const region = { mapId: 'swordhaven-first-book', regionKind: 'settlement' };
    const samples = Array.from({ length: 160 }, (_, day) => day * 1440 + 12 * 60 + 45);
    const weatherKind = (minute) => chroniclesRegionalWeather({
      ...region, worldMinutes: minute,
    })?.kind;
    const clear = samples.find(minute => weatherKind(minute) === 'clear');
    const fog = samples.find(minute => weatherKind(minute) === 'fog');
    expect(clear).toBeDefined();
    expect(fog).toBeDefined();
    expect(chroniclesRegionalWeatherTransition({
      ...region, worldMinutes: fog,
    }).fog).toBeGreaterThan(0.8);
    const cycle = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1.08 }, region);
    const initialCount = scene.children.length;
    cycle.sync(clear);
    const clearSkyline = sample(horizonIndex);
    const clearPanorama = panorama.color.clone();
    const clearForeground = foreground.color.clone();
    const clearOpacity = panorama.opacity;
    const baselineFogFar = scene.fog.far;
    cycle.sync(fog);
    const fogColor = scene.fog.color;
    expect(scene.fog.far).toBeLessThan(baselineFogFar);
    const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: fog });
    // Compare the SAME horizon before/after fogging. The natural zenith
    // happens to be close to fog grey on some days, so comparing altitude
    // colours directly is not a valid measure of atmospheric integration.
    const bareHorizon = new THREE.Color(0xb8dce9)
      .lerp(new THREE.Color(0x74838e), weather.clouds * 0.55);
    expect(colorDistance(sample(horizonIndex), fogColor))
      .toBeLessThan(colorDistance(bareHorizon, fogColor) * 0.55);
    expect(colorDistance(sample(topIndex), fogColor)).toBeGreaterThan(0.1);
    const unattenuated = new THREE.Color(0x3b4a5e)
      .lerp(new THREE.Color(0xc4cdd4), 1)
      .lerp(new THREE.Color(0x7d8993), weather.clouds * 0.62);
    const farVeil = colorDistance(panorama.color, unattenuated);
    const nearVeil = colorDistance(foreground.color, unattenuated);
    expect(farVeil).toBeGreaterThan(0.015);
    expect(nearVeil).toBeGreaterThan(0);
    expect(farVeil).toBeGreaterThan(nearVeil * 2);
    expect(panorama.opacity).toBeLessThan(0.11 + weather.clouds * 0.79);
    expect(panorama.fog).toBe(false);
    expect(scene.children.length).toBe(initialCount);
    cycle.sync(clear);
    expect(colorDistance(sample(horizonIndex), clearSkyline)).toBeLessThan(1e-6);
    expect(colorDistance(panorama.color, clearPanorama)).toBeLessThan(1e-6);
    expect(colorDistance(foreground.color, clearForeground)).toBeLessThan(1e-6);
    expect(panorama.opacity).toBeCloseTo(clearOpacity);
    expect(scene.fog.far).toBeCloseTo(baselineFogFar);
    expect(scene.children.length).toBe(initialCount);
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
