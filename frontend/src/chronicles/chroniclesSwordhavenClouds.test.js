import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addSwordhavenClouds } from './chroniclesSwordhaven3D.js';

describe('Swordhaven daylight cloud banks', () => {
  it.each([
    [false, 5],
    [true, 3],
  ])('keeps shaded, horizontally sculpted clouds decorative on coarsePointer=%s', (coarsePointer, count) => {
    const root = new THREE.Group();
    addSwordhavenClouds(root, coarsePointer);

    expect(root.children).toHaveLength(count);
    const lobes = root.children.flatMap(bank => {
      expect(bank.name).toMatch(/^swordhaven-cloud-\\d+$/);
      expect(bank.userData.chroniclesDecorativeOnly).toBe(true);
      expect(bank.position.y).toBeGreaterThan(15);
      expect(bank.children).toHaveLength(5);
      return bank.children;
    });

    expect(new Set(lobes.map(lobe => lobe.geometry)).size).toBe(1);
    expect(new Set(lobes.map(lobe => lobe.material)).size).toBe(1);
    expect(lobes[0].material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(lobes[0].material.transparent).toBe(false);
    expect(lobes[0].material.depthWrite).toBe(true);
    for (const lobe of lobes) {
      expect(lobe.name).toBe('cloud-puff');
      expect(lobe.scale.x / lobe.scale.y).toBeGreaterThan(2);
      expect(lobe.scale.z).toBeGreaterThan(lobe.scale.y);
      expect(lobe.castShadow).toBe(false);
      expect(lobe.receiveShadow).toBe(false);
      expect(lobe.userData.chroniclesDecorativeOnly).toBe(true);
    }
    // No new world collision, camera-follow behaviour, particles or lights.
    expect(root.children.every(bank => bank.children.every(child => child.isMesh))).toBe(true);
  });
});
