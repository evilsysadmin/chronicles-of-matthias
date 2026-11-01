import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addSwordhavenClouds } from './chroniclesSwordhaven3D.js';

describe('Swordhaven daylight cloud banks', () => {
  it.each([
    [false, 5],
    [true, 3],
  ])('uses one soft cloud atlas with no opaque discs on coarsePointer=%s', (coarsePointer, count) => {
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
    expect(material.map.image.width).toBe(128);
    expect(material.map.image.height).toBe(64);
    const rgba = material.map.image.data;
    const alpha = (x, y) => rgba[(y * 128 + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(127, 63)).toBe(0);
    expect(alpha(64, 32)).toBeGreaterThan(150);
    for (const bank of banks) {
      expect(bank.isSprite).toBe(true);
      expect(bank.name).toBe('cloud-soft-bank');
      expect(bank.scale.x / bank.scale.y).toBeGreaterThan(2);
      expect(bank.castShadow).toBe(false);
      expect(bank.receiveShadow).toBe(false);
      expect(bank.userData.chroniclesDecorativeOnly).toBe(true);
    }
  });
});
