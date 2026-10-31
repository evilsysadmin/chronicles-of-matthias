import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { swordhavenRoofRise, planSwordhavenRoofChimneys } from './chroniclesSwordhavenRoofTrim.js';
import { planSwordhavenDormers } from './chroniclesSwordhavenDormers.js';
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
  it.each([true, false])('caps seven authored roof runs with four lightweight timber batches on coarse=%s', (coarse) => {
    const town = townScene(swordhaven.id, coarse);
    const roofs = town.getObjectByName('chronicles-town-south-pitched-roofs');
    const eaves = town.getObjectByName('chronicles-town-south-roof-oak-eaves');
    const ridges = town.getObjectByName('chronicles-town-south-roof-oak-ridges');
    const verges = town.getObjectByName('chronicles-town-south-roof-oak-verges');
    const corbels = town.getObjectByName('chronicles-town-south-roof-oak-corbels');
    expect(roofs).toBeInstanceOf(THREE.InstancedMesh);
    expect(roofs.count).toBe(7);
    expect(eaves.count).toBe(roofs.count * 2);
    expect(ridges.count).toBe(roofs.count);
    expect(verges.count).toBe(roofs.count * 4);
    expect(corbels.count).toBe(roofs.count * 4);
    expect(corbels.geometry.parameters.width).toBeCloseTo(0.16);
    expect(corbels.geometry.parameters.height).toBeCloseTo(0.58);
    for (const part of [eaves, ridges, verges, corbels]) {
      expect(part).toBeInstanceOf(THREE.InstancedMesh);
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.castShadow).toBe(false);
      expect(part.receiveShadow).toBe(true);
      expect(part.frustumCulled).toBe(false);
      expect(part.instanceColor).toBeTruthy();
    }
    expect(eaves.material).toBe(ridges.material);
    expect(ridges.material).toBe(verges.material);
    expect(verges.material).toBe(corbels.material);
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
      const span = swordhaven.landscape.roofRuns[i].width * 4 + 0.44;
      for (const [endIndex, end] of [-1, 1].entries()) {
        for (const [sideIndex, side] of [-1, 1].entries()) {
          corbels.getMatrixAt(i * 4 + endIndex * 2 + sideIndex, trimMatrix);
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          trimMatrix.decompose(position, rotation, scale);
          expect(position.x).toBeCloseTo(roofPos.x + end * (span / 2 - 1.10));
          expect(position.y).toBeCloseTo(roofPos.y - 0.22);
          expect(position.z).toBeCloseTo(roofPos.z + side * 2);
          for (const axis of scale.toArray()) expect(axis).toBeCloseTo(1, 5);
          // Slant outwards as it rises, directly under the matching eave.
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
          expect(up.y).toBeCloseTo(Math.cos(0.42));
          expect(up.z * side).toBeCloseTo(Math.sin(0.42));
          // Even at maximum rotation the support cannot reach player height.
          expect(position.y - 0.58 / 2 - 0.13 / 2).toBeGreaterThan(5.7);
          expect(Math.abs(position.z - roofPos.z) + 0.20).toBeLessThan(2.22);
        }
      }
    }
    // No new roof paths, game interactions or blockers.
    expect(town.getObjectByName('chronicles-town-street-window-panes')).toBeTruthy();
    expect(town.getObjectByName('chronicles-campaign-town-perimeter')).toBeFalsy();
  });

  it.each([true, false])('draws four non-overlapping inhabited roof flues in two batches at coarse=%s', (coarse) => {
    const center = { x: 9, y: 11 };
    const runs = swordhaven.landscape.roofRuns;
    const chimneyPlan = planSwordhavenRoofChimneys(runs, center, 6.4);
    expect(chimneyPlan).toEqual(planSwordhavenRoofChimneys(runs, center, 6.4));
    expect(chimneyPlan.map(({ xCell, yCell, width }) => [xCell, yCell, width])).toEqual([
      [2, 16, 4], [13, 20, 4], [7, 16, 5], [4, 18, 2],
    ]);
    expect(new Set(chimneyPlan.map(entry => entry.variant))).toEqual(new Set([0, 1, 2]));
    const dormers = planSwordhavenDormers(runs, swordhaven.grid, center, 6.4);
    for (const entry of chimneyPlan) {
      const rise = swordhavenRoofRise({ x: entry.xCell, y: entry.yCell, width: entry.width });
      const roofCenterZ = (entry.yCell - center.y) * 4;
      const actualSurface = 6.36 + rise * (1 - Math.abs(entry.z - roofCenterZ) / 2.22);
      expect(entry.roofY).toBeCloseTo(actualSurface);
      expect(swordhaven.grid[entry.yCell].slice(entry.xCell, entry.xCell + entry.width))
        .toBe('#'.repeat(entry.width));
      // Dormers occupy other bay positions: do not put a chimney through glass.
      expect(dormers.every(window =>
        Math.hypot(entry.x - window.x, entry.z - window.z) > 1.25)).toBe(true);
    }
    const town = townScene(swordhaven.id, coarse);
    const shafts = town.getObjectByName('chronicles-town-residential-chimney-shafts');
    const flues = town.getObjectByName('chronicles-town-residential-chimney-flues');
    expect(shafts).toBeInstanceOf(THREE.InstancedMesh);
    expect(flues).toBeInstanceOf(THREE.InstancedMesh);
    for (const mesh of [shafts, flues]) {
      expect(mesh.count).toBe(4);
      expect(mesh.userData.chroniclesDecorativeOnly).toBe(true);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.receiveShadow).toBe(true);
    }
    expect(shafts.geometry.index.count).toBe(7 * 36); // Body, foot, crown and four rim stones.
    const shaftBounds = new THREE.Box3().setFromBufferAttribute(
      shafts.geometry.getAttribute('position'));
    expect(shaftBounds.max.y).toBeCloseTo(0.6525);
    expect(shaftBounds.min.y).toBeCloseTo(-0.5);
    const brickBond = shafts.material.map;
    expect(brickBond).toBeInstanceOf(THREE.DataTexture);
    expect(brickBond.name).toBe('chronicles-town-residential-chimney-brick-bond');
    expect(brickBond.image.width).toBe(64);
    expect(brickBond.image.height).toBe(64);
    expect(brickBond.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(brickBond.magFilter).toBe(THREE.NearestFilter);
    const pixel = (x, y) => brickBond.image.data[(y * 64 + x) * 4];
    expect(pixel(0, 1)).toBe(105); // Even row: vertical joint at x=0.
    expect(pixel(0, 9)).toBeGreaterThan(200); // Odd row shifts the brick bond.
    expect(pixel(10, 9)).toBe(105); // Offset joint.
    expect(pixel(5, 8)).toBe(105); // Horizontal mortar course.
    expect(pixel(5, 9)).toBeGreaterThan(200);
    expect(shafts.material.emissive.getHex()).toBe(0);
    expect(flues.geometry.index.count).toBe(36);
    expect(flues.geometry.parameters.width).toBeCloseTo(0.64);
    expect(flues.geometry.parameters.depth).toBeCloseTo(0.48);
    expect(shafts.instanceColor).toBeTruthy();
    const colors = new Set();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (const [index, entry] of chimneyPlan.entries()) {
      shafts.getMatrixAt(index, matrix);
      matrix.decompose(position, new THREE.Quaternion(), scale);
      expect(position.x).toBeCloseTo(entry.x);
      expect(position.z).toBeCloseTo(entry.z);
      expect(position.y).toBeCloseTo(entry.roofY - 0.16 + entry.height / 2);
      expect(scale.y).toBeCloseTo(entry.height);
      // Foot embeds in the roof, but the crown clears its ridge.
      expect(position.y - entry.height / 2).toBeLessThan(entry.roofY);
      expect(position.y + entry.height * 0.56)
        .toBeGreaterThan(6.36 + swordhavenRoofRise({ x: entry.xCell, y: entry.yCell, width: entry.width }));
      const color = new THREE.Color();
      shafts.getColorAt(index, color);
      colors.add(color.getHexString());
      flues.getMatrixAt(index, matrix);
      matrix.decompose(position, new THREE.Quaternion(), scale);
      expect(position.x).toBeCloseTo(entry.x);
      expect(position.y).toBeCloseTo(entry.roofY - 0.16 + entry.height * 1.117);
      expect(position.z).toBeCloseTo(entry.z);
    }
    expect(colors.size).toBe(3);
  });

  it('does not decorate other settlements that happen to have roof runs', () => {
    const town = townScene('other-authored-settlement', true);
    expect(town.getObjectByName('chronicles-town-south-pitched-roofs')).toBeTruthy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-eaves')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-ridges')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-verges')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-south-roof-oak-corbels')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-residential-chimney-shafts')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-residential-chimney-flues')).toBeFalsy();
  });
});
