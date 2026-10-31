import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { swordhavenRoofRise } from './chroniclesSwordhavenRoofTrim.js';
import swordhaven from './maps/swordhaven-first-book.json';

function townScene(mapId = swordhaven.id, coarsePointer = false) {
  const scene = new THREE.Scene();
  const content = [...swordhaven.interactables, ...swordhaven.exits]
    .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: {
      mapId, regionKind: swordhaven.regionKind,
      width: swordhaven.grid[0].length, height: swordhaven.grid.length,
      center: { x: 9, y: 11 }, grid: swordhaven.grid,
      landscape: swordhaven.landscape, content,
    },
  });
  return scene.getObjectByName('chronicles-campaign-town');
}

describe('Swordhaven authored terrace roofline dressing', () => {
  it.each([true, false])('caps exactly the seven existing roof runs with three lightweight batches on coarse=%s', (coarse) => {
    const town = townScene(swordhaven.id, coarse);
    const roofs = town.getObjectByName('chronicles-town-south-pitched-roofs');
    const eaves = town.getObjectByName('chronicles-town-south-roof-oak-eaves');
    const ridges = town.getObjectByName('chronicles-town-south-roof-oak-ridges');
    const verges = town.getObjectByName('chronicles-town-south-roof-oak-verges');
    expect(roofs).toBeInstanceOf(THREE.InstancedMesh);
    expect(roofs.count).toBe(7);
    expect(eaves.count).toBe(roofs.count * 2);
    expect(ridges.count).toBe(roofs.count);
    expect(verges.count).toBe(roofs.count * 4);
    for (const part of [eaves, ridges, verges]) {
      expect(part).toBeInstanceOf(THREE.InstancedMesh);
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.castShadow).toBe(false);
      expect(part.receiveShadow).toBe(true);
      expect(part.frustumCulled).toBe(false);
      expect(part.instanceColor).toBeTruthy();
    }
    expect(eaves.material).toBe(ridges.material);
    expect(ridges.material).toBe(verges.material);
    const roofMatrix = new THREE.Matrix4();
    const trimMatrix = new THREE.Matrix4();
    const roofPos = new THREE.Vector3();
    const trimPos = new THREE.Vector3();
    for (let i = 0; i < roofs.count; i += 1) {
      const rise = swordhavenRoofRise(swordhaven.landscape.roofRuns[i]);
      roofs.getMatrixAt(i, roofMatrix);
      ridges.getMatrixAt(i, trimMatrix);
      roofPos.setFromMatrixPosition(roofMatrix);
      trimPos.setFromMatrixPosition(trimMatrix);
      expect(trimPos.x).toBeCloseTo(roofPos.x);
      expect(trimPos.z).toBeCloseTo(roofPos.z);
      expect(trimPos.y).toBeCloseTo(roofPos.y + rise + 0.035);
      eaves.getMatrixAt(i * 2, trimMatrix);
      trimPos.setFromMatrixPosition(trimMatrix);
      expect(trimPos.y).toBeGreaterThan(6.0);
      expect(trimPos.y).toBeLessThan(6.5);
      eaves.getMatrixAt(i * 2 + 1, trimMatrix);
      const opposite = new THREE.Vector3().setFromMatrixPosition(trimMatrix);
      expect(opposite.z - trimPos.z).toBeCloseTo(4.44);
      verges.getMatrixAt(i * 4, trimMatrix);
      trimPos.setFromMatrixPosition(trimMatrix);
      expect(trimPos.y).toBeCloseTo(roofPos.y + rise / 2 + 0.035);
      const slopeScale = new THREE.Vector3().setFromMatrixScale(trimMatrix);
      expect(slopeScale.z).toBeCloseTo(Math.hypot(2.22, rise) / Math.hypot(2.22, 0.92));
    }
    // No new roof paths, game interactions or blockers.
    expect(town.getObjectByName('chronicles-town-street-window-panes')).toBeTruthy();
    expect(town.getObjectByName('chronicles-campaign-town-perimeter')).toBeFalsy();
  });

  it('does not decorate other settlements that happen to have roof runs', () => {
    const town = townScene('other-authored-settlement', true);
    expect(town.getObjectByName('chronicles-town-south-pitched-roofs')).toBeTruthy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-eaves')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-ridges')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-verges')).toBeFalsy();
  });
});
