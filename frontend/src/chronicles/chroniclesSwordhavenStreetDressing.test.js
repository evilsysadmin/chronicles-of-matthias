import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

function createStreetScene(coarsePointer, mapId = swordhaven.id) {
  const scene = new THREE.Scene();
  const content = [...swordhaven.interactables, ...swordhaven.exits]
    .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y }, visible: true }));
  buildChroniclesCampaignExterior(scene, {
    coarsePointer,
    scenePlan: {
      mapId, regionKind: swordhaven.regionKind,
      width: swordhaven.grid[0].length, height: swordhaven.grid.length,
      center: { x: 9, y: 11 }, grid: swordhaven.grid,
      content, landscape: swordhaven.landscape,
    },
  });
  return scene;
}

describe('Swordhaven premium residential street windows', () => {
  it.each([true, false])('reuses batched hoods, braces and sparse planters on coarse=%s', (coarse) => {
    const scene = createStreetScene(coarse);
    const town = scene.getObjectByName('chronicles-campaign-town');
    const frames = town.getObjectByName('chronicles-town-street-window-frames');
    const names = [
      'chronicles-town-street-oak-window-hoods',
      'chronicles-town-street-hood-knee-braces',
      'chronicles-town-street-terracotta-window-boxes',
      'chronicles-town-street-window-box-foliage',
      'chronicles-town-street-window-box-blooms',
    ];
    const [hoods, braces, pots, leaves, petals] = names.map(name => town.getObjectByName(name));
    for (const part of [hoods, braces, pots, leaves, petals]) {
      expect(part).toBeInstanceOf(THREE.InstancedMesh);
      expect(part.userData.chroniclesDecorativeOnly).toBe(true);
      expect(part.castShadow).toBe(false);
      expect(part.count).toBeGreaterThan(0);
      expect(part.frustumCulled).toBe(false);
    }
    expect(hoods.count).toBe(frames.count);
    expect(braces.count).toBe(hoods.count * 2);
    expect(pots.count).toBeLessThan(hoods.count / 2);
    expect(leaves.count).toBe(pots.count * (coarse ? 3 : 5));
    expect(petals.count).toBe(pots.count * (coarse ? 1 : 3));
    expect(pots.instanceColor).toBeTruthy();
    expect(leaves.instanceColor).toBeTruthy();
    expect(petals.instanceColor).toBeTruthy();
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < pots.count; index += 1) {
      pots.getMatrixAt(index, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(position.y).toBeCloseTo(1.51);
      // Sparse hanging boxes live ABOVE the street, not on the ground.
      expect(position.y - pots.geometry.parameters.height / 2).toBeGreaterThan(1.3);
    }
    for (let index = 0; index < hoods.count; index += 1) {
      hoods.getMatrixAt(index, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect([2.72, 5.02].some(height => Math.abs(position.y - height) < 0.01)).toBe(true);
    }
    // The authored grid, actual doors and live interactions remain unchanged.
    expect(scene.getObjectByName('chronicles-campaign-visible-blockers')).toBeTruthy();
    expect(town.getObjectByName('swordhaven-building-first-book-hall-0')).toBeUndefined();
    expect(town.getObjectByName('chronicles-town-street-window-panes').count).toBe(frames.count);
  });

  it('never applies the Swordhaven-only streetscape to another settlement id', () => {
    const other = createStreetScene(true, 'other-authored-settlement');
    expect(other.getObjectByName('chronicles-town-street-window-frames')).toBeTruthy();
    expect(other.getObjectByName('chronicles-town-street-oak-window-hoods')).toBeFalsy();
    expect(other.getObjectByName('chronicles-town-street-terracotta-window-boxes')).toBeFalsy();
  });
});
