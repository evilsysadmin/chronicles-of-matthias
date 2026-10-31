import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import swordhaven from './maps/swordhaven-first-book.json';
import { planSwordhavenDormers } from './chroniclesSwordhavenDormers.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';

function buildTown(mapId = swordhaven.id, coarsePointer = false) {
  const scene = new THREE.Scene();
  const content = [...swordhaven.interactables, ...swordhaven.exits]
    .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: {
      mapId, regionKind: swordhaven.regionKind,
      width: swordhaven.grid[0].length, height: swordhaven.grid.length,
      grid: swordhaven.grid, center: { x: 9, y: 11 },
      content, landscape: swordhaven.landscape,
    },
  });
  return scene.getObjectByName('chronicles-campaign-town');
}

describe('Swordhaven inhabited terrace roof dormers', () => {
  it('uses the real authored street side, with no new roof cells or randomness', () => {
    const plan = () => planSwordhavenDormers(
      swordhaven.landscape.roofRuns, swordhaven.grid, { x: 9, y: 11 }, 6.4,
    );
    const entries = plan();
    expect(entries).toHaveLength(6);
    expect(plan()).toEqual(entries);
    const points = new Set(entries.map(item => item.x + ':' + item.z));
    expect(points.size).toBe(entries.length);
    for (const entry of entries) {
      expect([-1, 1]).toContain(entry.side);
      expect(entry.y).toBeGreaterThan(6.5);
      expect(entry.y).toBeLessThan(6.9);
      expect(entry.variant).toBeGreaterThanOrEqual(0);
      expect(entry.variant).toBeLessThanOrEqual(2);
    }
    const changes = planSwordhavenDormers(
      swordhaven.landscape.roofRuns, swordhaven.grid.map(r => r.replaceAll('.', '#')),
      { x: 9, y: 11 }, 6.4,
    );
    expect(changes).toEqual([]);
  });

  it.each([true, false])('draws real dormers in six instanced batches on coarse=%s', (coarse) => {
    const town = buildTown(swordhaven.id, coarse);
    const names = ['plaster', 'glass', 'cheeks', 'posts', 'lintels',
      'pitched-roofs', 'window-casements'];
    const batches = names.map(name =>
      town.getObjectByName('chronicles-town-residential-dormer-' + name));
    const [front, glass, cheeks, posts, lintels, roofs, casements] = batches;
    for (const batch of batches) {
      expect(batch).toBeInstanceOf(THREE.InstancedMesh);
      expect(batch.userData.chroniclesDecorativeOnly).toBe(true);
      expect(batch.castShadow).toBe(false);
      expect(batch.frustumCulled).toBe(false);
      expect(batch.receiveShadow).toBe(true);
    }
    expect(front.count).toBe(6);
    expect(glass.count).toBe(6);
    expect(cheeks.count).toBe(12);
    expect(posts.count).toBe(12);
    expect(lintels.count).toBe(12);
    expect(roofs.count).toBe(12);
    expect(casements.count).toBe(6);
    // Three box components, one draw call for all six windows. Glass is
    // larger and blue-grey rather than an opaque or glowing square.
    expect(glass.geometry.parameters.width).toBeCloseTo(0.82);
    expect(glass.geometry.parameters.height).toBeCloseTo(0.50);
    expect(glass.material.color.getHex()).toBe(0x48565e);
    expect(glass.material.emissiveIntensity).toBeLessThan(0.10);
    expect(casements.material).toBe(cheeks.material);
    expect(casements.geometry.index.count).toBe(3 * 36);
    const silhouette = new THREE.Box3().setFromBufferAttribute(
      casements.geometry.getAttribute('position'));
    expect(silhouette.min.x).toBeLessThan(-0.55);
    expect(silhouette.max.x).toBeGreaterThan(0.55);
    expect(silhouette.min.y).toBeLessThan(-0.36);
    expect(silhouette.max.y).toBeGreaterThan(0.23);
    expect(front.instanceColor).toBeTruthy();
    expect(roofs.instanceColor).toBeTruthy();
    expect(roofs.material).toBe(town.getObjectByName('chronicles-town-south-pitched-roofs').material);
    const plan = planSwordhavenDormers(
      swordhaven.landscape.roofRuns, swordhaven.grid, { x: 9, y: 11 }, 6.4,
    );
    const matrix = new THREE.Matrix4();
    const location = new THREE.Vector3();
    for (const [index, entry] of plan.entries()) {
      front.getMatrixAt(index, matrix);
      location.setFromMatrixPosition(matrix);
      expect(location.x).toBeCloseTo(entry.x);
      expect(location.y).toBeCloseTo(entry.y + 0.50);
      expect(location.z).toBeCloseTo(entry.z);
      glass.getMatrixAt(index, matrix);
      location.setFromMatrixPosition(matrix);
      expect(location.z).toBeCloseTo(entry.z + entry.side * 0.092);
      casements.getMatrixAt(index, matrix);
      location.setFromMatrixPosition(matrix);
      expect(location.x).toBeCloseTo(entry.x);
      expect(location.y).toBeCloseTo(entry.y + 0.54);
      // Timber sits proud of the glazing on both street-facing slopes.
      expect((location.z - entry.z) * entry.side).toBeGreaterThan(0.12);
      roofs.getMatrixAt(index * 2, matrix);
      location.setFromMatrixPosition(matrix);
      expect(location.y).toBeCloseTo(entry.y + 1.075);
    }
    expect(town.getObjectByName('chronicles-town-south-roof-oak-eaves').count).toBe(14);
    expect(town.getObjectByName('chronicles-town-street-window-frames')).toBeTruthy();
  });

  it('leaves other settlements without Swordhaven-only dormers', () => {
    const town = buildTown('other-authored-settlement', true);
    expect(town.getObjectByName('chronicles-town-south-pitched-roofs')).toBeTruthy();
    expect(town.getObjectByName('chronicles-town-residential-dormer-plaster')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-residential-dormer-pitched-roofs')).toBeFalsy();
    expect(town.getObjectByName('chronicles-town-residential-dormer-window-casements')).toBeFalsy();
  });
});
