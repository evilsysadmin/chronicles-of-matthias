import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dressSwordhavenStoreLoadingRoof } from './chroniclesSwordhavenStoreLoadingRoof.js';

function makeDock() {
  const dock = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(1.88, 0.17, 5.42),
    new THREE.MeshStandardMaterial({ color: 0x8c7357 }),
  );
  canopy.name = 'store-loading-dock-cedar-roof';
  canopy.position.set(4.96, 3.79, 0);
  canopy.rotation.z = -0.32;
  dock.add(canopy);
  return { dock, canopy, mats: { timber: new THREE.MeshStandardMaterial({ color: 0x785a40 }) } };
}

describe('Swordhaven provisions loading-dock roof', () => {
  it.each([false, true])('has three decorative underside rafters in the solid footprint (coarse=%s)', coarse => {
    const { dock, canopy, mats } = makeDock();
    const first = dressSwordhavenStoreLoadingRoof(dock, { mats, coarse });
    expect(first?.name).toBe('store-loading-dock-cedar-planks');
    const rafters = dock.getObjectByName('store-loading-dock-oak-underside-rafters');
    expect(rafters).toBeInstanceOf(THREE.InstancedMesh);
    expect(rafters.count).toBe(3);
    expect(rafters.material).toBe(mats.timber);
    expect(rafters.userData.chroniclesDecorativeOnly).toBe(true);
    expect(rafters.castShadow).toBe(!coarse);
    expect(rafters.position.equals(canopy.position)).toBe(true);
    expect(rafters.geometry.parameters.width).toBeCloseTo(1.70);
    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    const zPositions = [];
    for (let index = 0; index < rafters.count; index += 1) {
      rafters.getMatrixAt(index, matrix);
      center.setFromMatrixPosition(matrix);
      expect(center.y).toBeLessThan(-0.12);
      expect(center.y).toBeGreaterThan(-0.20);
      zPositions.push(center.z);
    }
    expect(zPositions[0]).toBeLessThan(-1.7);
    expect(zPositions[1]).toBe(0);
    expect(zPositions[2]).toBeGreaterThan(1.7);
    const eave = dock.getObjectByName('store-loading-dock-oak-outer-eave');
    expect(eave).toBeInstanceOf(THREE.Mesh);
    expect(eave.material).toBe(mats.timber);
    expect(eave.userData.chroniclesDecorativeOnly).toBe(true);
    expect(eave.rotation.z).toBeCloseTo(canopy.rotation.z);
    expect(eave.position.x).toBeGreaterThan(canopy.position.x + 0.5);
    expect(eave.position.y).toBeLessThan(canopy.position.y - 0.2);
    expect(new THREE.Box3().setFromObject(eave).max.x).toBeLessThan(6);
    const bounds = new THREE.Box3().setFromObject(rafters);
    expect(bounds.max.x).toBeLessThan(6);
    expect(bounds.min.y).toBeGreaterThan(3.1);
    expect(bounds.max.z).toBeLessThan(2.72);
    expect(bounds.min.z).toBeGreaterThan(-2.72);
    expect(dressSwordhavenStoreLoadingRoof(dock, { mats, coarse })).toBe(first);
    expect(dock.children.filter(child => child.name === rafters.name)).toHaveLength(1);
    expect(dock.children.every(child => !child.isLight)).toBe(true);
  });

  it('does not dress an unrelated roof or create missing materials', () => {
    const dock = new THREE.Group();
    expect(dressSwordhavenStoreLoadingRoof(dock, { mats: { timber: new THREE.MeshStandardMaterial() } })).toBeNull();
    expect(dressSwordhavenStoreLoadingRoof(dock)).toBeNull();
    expect(dock.children).toHaveLength(0);
  });
});
