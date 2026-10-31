import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven provisions canvas canopy', () => {
  it.each([true, false])('drapes striped fabric without blocking the shop on coarsePointer=%s', (coarsePointer) => {
    const scene = new THREE.Scene();
    const content = [...swordhaven.interactables, ...swordhaven.exits]
      .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id, regionKind: swordhaven.regionKind,
        width: swordhaven.grid[0].length, height: swordhaven.grid.length,
        center: { x: 9, y: 11 }, grid: swordhaven.grid,
        content, landscape: swordhaven.landscape,
      },
    });
    const town = scene.getObjectByName('chronicles-campaign-town');
    const store = town.children.find(child => child.name.startsWith('swordhaven-building-first-book-store-'));
    const forge = town.children.find(child => child.name.startsWith('swordhaven-building-first-book-forge-'));
    const awning = store.getObjectByName('store-market-awning');
    expect(awning.userData.chroniclesDecorativeOnly).toBe(true);
    const cloth = awning.getObjectByName('store-awning-cloth');
    const stripes = awning.getObjectByName('store-awning-stripe');
    expect(cloth.geometry.type).toBe('BoxGeometry');
    expect(cloth.material.side).toBe(THREE.DoubleSide);
    expect(cloth.userData.chroniclesDecorativeOnly).toBe(true);
    expect(stripes).toBeInstanceOf(THREE.InstancedMesh);
    expect(stripes.count).toBe(6);
    expect(stripes.geometry.type).toBe('BoxGeometry');
    expect(stripes.material.side).toBe(THREE.DoubleSide);
    expect(cloth.geometry.parameters.height).toBeCloseTo(0.10);
    expect(stripes.geometry.parameters.height).toBeCloseTo(0.018);
    expect(stripes.material.color.getHex()).not.toBe(cloth.material.color.getHex());
    expect(stripes.userData.chroniclesDecorativeOnly).toBe(true);
    const underside = awning.getObjectByName('store-awning-underside-stripe');
    expect(underside).toBeInstanceOf(THREE.InstancedMesh);
    expect(underside.count).toBe(6);
    expect(underside.geometry).toBe(stripes.geometry);
    expect(underside.material).toBe(stripes.material);
    expect(underside.userData.chroniclesDecorativeOnly).toBe(true);
    // Retain the street-visible pitch; a horizontal drape hides the stripes
    // behind the front valance in both desktop and mobile views.
    for (const surface of [cloth, stripes, underside]) {
      expect(surface.rotation.x).toBeCloseTo(0.16);
    }
    // Both thin-edged fabrics sag in the middle without vanishing edge-on.
    for (const geometry of [cloth.geometry, stripes.geometry]) {
      const positions = geometry.getAttribute('position');
      const ys = Array.from({ length: positions.count }, (_, index) => positions.getY(index));
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.10);
      expect(Math.min(...ys)).toBeLessThan(-0.10);
    }
    const transform = new THREE.Matrix4();
    const xs = [];
    for (let i = 0; i < stripes.count; i += 1) {
      stripes.getMatrixAt(i, transform);
      xs.push(new THREE.Vector3().setFromMatrixPosition(transform).x);
    }
    for (const [index, expected] of [-2.45, -1.47, -0.49, 0.49, 1.47, 2.45].entries()) {
      expect(xs[index]).toBeCloseTo(expected, 4);
    }
    store.updateWorldMatrix(true, true);
    expect(new THREE.Box3().setFromObject(awning).min.y).toBeGreaterThan(2.5);
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    expect(forge.getObjectByName('store-market-awning')).toBeFalsy();
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
