import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { planSwordhavenAlleyLaundry } from './chroniclesSwordhavenAlleyLaundry.js';
import swordhaven from './maps/swordhaven-first-book.json';

function makeTown(mapId = swordhaven.id) {
  const scene = new THREE.Scene();
  buildChroniclesCampaignExterior(scene, {
    coarsePointer: true,
    scenePlan: {
      mapId, regionKind: swordhaven.regionKind,
      width: swordhaven.grid[0].length, height: swordhaven.grid.length,
      center: { x: 9, y: 11 }, grid: swordhaven.grid,
      landscape: swordhaven.landscape, content: [],
    },
  });
  return scene.getObjectByName('chronicles-campaign-town');
}

describe('Swordhaven occupied narrow alleys', () => {
  it('selects only four genuinely walkable corridors with two opposing solid anchors', () => {
    const actual = planSwordhavenAlleyLaundry(swordhaven.grid);
    expect(actual).toEqual([3, 6, 12, 15].map(x => ({ x, y: 18 })));
    for (const { x, y } of actual) {
      expect(swordhaven.grid[y][x]).toBe('.');
      expect(swordhaven.grid[y][x - 1]).toBe('#');
      expect(swordhaven.grid[y][x + 1]).toBe('#');
      expect(swordhaven.grid[y - 1][x]).toBe('.');
      expect(swordhaven.grid[y + 1][x]).toBe('.');
    }
    const shifted = [...swordhaven.grid];
    shifted[18] = shifted[18].slice(0, 5) + '.' + shifted[18].slice(6);
    expect(planSwordhavenAlleyLaundry(shifted)).toEqual(actual.filter(p => p.x !== 6));
    expect(planSwordhavenAlleyLaundry(null)).toEqual([]);
  });

  it('batches ropes and folded fabric well above the walkable pavement', () => {
    const town = makeTown();
    const ropes = town.getObjectByName('chronicles-town-alley-laundry-ropes');
    const linen = town.getObjectByName('chronicles-town-alley-hanging-linen');
    expect(ropes).toBeInstanceOf(THREE.InstancedMesh);
    expect(linen).toBeInstanceOf(THREE.InstancedMesh);
    expect(ropes.count).toBe(4);
    expect(linen.count).toBe(12);
    expect(linen.material.side).toBe(THREE.DoubleSide);
    expect(linen.geometry.getAttribute('position').count).toBe(30); // 4 × 5 subdivisions.
    expect(linen.geometry.getAttribute('position').getZ(0)).not.toBe(0);
    expect(linen.instanceColor).toBeTruthy();
    const colors = new Set();
    const matrix = new THREE.Matrix4();
    const at = new THREE.Vector3();
    const clothBounds = new THREE.Box3()
      .setFromBufferAttribute(linen.geometry.getAttribute('position'));
    for (const [index, x] of [3, 6, 12, 15].entries()) {
      ropes.getMatrixAt(index, matrix);
      at.setFromMatrixPosition(matrix);
      expect(at.x).toBeCloseTo((x - 9) * 4);
      expect(at.y).toBeCloseTo(3.9);
      expect(at.z).toBeCloseTo((18 - 11) * 4);
      for (const [slot, lateral] of [-1.12, 0, 1.12].entries()) {
        const i = index * 3 + slot;
        linen.getMatrixAt(i, matrix);
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(at, rotation, scale);
        expect(at.x).toBeCloseTo((x - 9) * 4 + lateral);
        expect(at.z).toBeCloseTo((18 - 11) * 4 + (slot % 2 === 0 ? 0.02 : -0.02));
        expect(at.y + clothBounds.max.y * scale.y).toBeCloseTo(3.9);
        expect(at.y + clothBounds.min.y * scale.y).toBeGreaterThan(2.8);
        const tint = new THREE.Color();
        linen.getColorAt(i, tint);
        colors.add(tint.getHexString());
      }
    }
    expect(colors.size).toBeGreaterThanOrEqual(4);
    for (const part of [ropes, linen]) {
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.frustumCulled).toBe(false);
      expect(part.castShadow).toBe(false);
      expect(part.receiveShadow).toBe(true);
    }
    expect(town.getObjectByName('chronicles-town-alley-laundry-clothes-pegs')).toBeFalsy();
  });

  it('does not decorate other settlements', () => {
    const town = makeTown('other-authored-settlement');
    expect(town.getObjectByName('chronicles-town-alley-laundry-ropes')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-alley-hanging-linen')).toBeFalsy();
  });
});
