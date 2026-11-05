import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSwordhavenSkyDome } from './chroniclesSwordhaven3D.js';
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

  it('does not change the dungeon renderer when no exterior sun is present', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0c0f, 0.034);
    const renderer = { toneMappingExposure: 0.88 };
    expect(createChroniclesExteriorDaylight(scene, renderer)).toBeNull();
    expect(renderer.toneMappingExposure).toBe(0.88);
    expect(scene.fog.color.getHex()).toBe(0x0a0c0f);
  });
});
