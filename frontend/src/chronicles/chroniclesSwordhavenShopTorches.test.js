import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSwordhavenScene, SWORDHAVEN_BUILDINGS,
} from './chroniclesSwordhaven3D.js';

describe('Swordhaven sheltered medieval shop braziers', () => {
  it.each([true, false])('replaces cone flames with covered, decorative fire on each shop (coarse=%s)', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    for (const spec of SWORDHAVEN_BUILDINGS) {
      const house = scene.getObjectByName('swordhaven-building-' + spec.id);
      const plaque = house.getObjectByName('swordhaven-shop-nameplate');
      const hoods = plaque.getObjectByName('shop-sign-torch-hoods');
      const sconces = plaque.getObjectByName('shop-sign-torch-sconces');
      const flames = plaque.getObjectByName('shop-sign-torch-flames');
      const wash = house.getObjectByName('shop-sign-torch-wallwash');
      expect(plaque.getObjectByName('shop-sign-torch-wallwash')).toBeUndefined();
      const outer = flames.getObjectByName('shop-sign-torch-outer-flame');
      const inner = flames.getObjectByName('shop-sign-torch-inner-flame');
      const awning = hoods.getObjectByName('shop-sign-torch-shelter-wood');
      const iron = sconces.getObjectByName('shop-sign-torch-wrought-iron');

      expect(hoods.userData.chroniclesDecorativeOnly).toBe(true);
      expect(sconces.userData.chroniclesDecorativeOnly).toBe(true);
      expect(flames.userData.chroniclesDecorativeOnly).toBe(true);
      expect(wash.userData.chroniclesDecorativeOnly).toBe(true);
      expect(awning).toBeInstanceOf(THREE.Mesh);
      expect(iron).toBeInstanceOf(THREE.Mesh);
      expect(outer.geometry.type).not.toBe('ConeGeometry');
      expect(inner.geometry.type).not.toBe('ConeGeometry');
      expect(outer.geometry.attributes.position.count).toBeGreaterThan(20);
      expect(flames.visible).toBe(false);
      expect(wash.visible).toBe(false);
      expect(wash.material.map).toBeInstanceOf(THREE.DataTexture);
      expect(wash.material.opacity).toBe(0);
      expect(flames.userData.outerFire).toBe(outer.material);
      expect(flames.userData.innerFire).toBe(inner.material);

      // In plaque-local space, the weatherproof sloping eave extends both
      // forward and above the full organic fire. It also covers both sides
      // of the inscription without occupying a traversable map tile.
      awning.geometry.computeBoundingBox();
      outer.geometry.computeBoundingBox();
      const roof = awning.geometry.boundingBox;
      const fire = outer.geometry.boundingBox;
      expect(roof.max.y).toBeGreaterThan(fire.max.y + 0.08);
      expect(roof.max.z).toBeGreaterThan(fire.max.z + 0.20);
      expect(roof.min.x).toBeLessThan(fire.min.x);
      expect(roof.max.x).toBeGreaterThan(fire.max.x);
      expect(plaque.getObjectByName('shop-nameplate-lettering')).toBeTruthy();
      expect(house.getObjectByName('shop-door')).toBeTruthy();
      expect(house.getObjectByName('swordhaven-interaction-' + spec.id)).toBeTruthy();
      for (const part of [...hoods.children, ...sconces.children, ...flames.children, wash]) {
        expect(part.userData.chroniclesDecorativeOnly).toBe(true);
        expect(part.castShadow).toBe(false);
        expect(part.isLight).not.toBe(true);
      }
    }
    const pointLights = [];
    scene.traverse((node) => { if (node.isPointLight) pointLights.push(node); });
    expect(pointLights).toHaveLength(0);
  });
});
