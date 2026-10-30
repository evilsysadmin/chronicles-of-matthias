import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene } from './chroniclesSwordhaven3D.js';

describe('Swordhaven temple belfry silhouette', () => {
  it.each([true, false])('adds four visible decorative bell arches without moving the temple at coarse=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const temple = scene.getObjectByName('swordhaven-building-swordhaven-temple');
    expect(temple).toBeTruthy();
    const belfry = temple?.getObjectByName('temple-belfry-openings');
    expect(belfry?.userData.chroniclesDecorativeOnly).toBe(true);
    const bays = belfry.children.filter(child => child.name === 'temple-belfry-arched-bay');
    expect(bays).toHaveLength(4);
    expect(bays.map(bay => Number(bay.rotation.y.toFixed(3))))
      .toEqual([0, 1.571, 3.142, -1.571]);
    for (const bay of bays) {
      expect(bay.getObjectByName('temple-belfry-dark-arch')).toBeTruthy();
      expect(bay.getObjectByName('temple-belfry-limestone-arch')).toBeTruthy();
      expect(bay.children.filter(child => child.name === 'temple-belfry-limestone-jamb'))
        .toHaveLength(2);
      expect(bay.getObjectByName('temple-belfry-bronze-bell')).toBeTruthy();
      expect(bay.position.y).toBeGreaterThan(9);
      expect(bay.position.y).toBeLessThan(10.4);
    }
    expect(temple.getObjectByName('temple-bell-tower')).toBeTruthy();
    expect(temple.getObjectByName('temple-spire')).toBeTruthy();
    expect(temple.getObjectByName('shop-door')).toBeTruthy();
  });
});
