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

  it.each([true, false])('places sparse upper Juliet railings only on authored south windows at coarse=%s', (coarse) => {
    const town = createStreetScene(coarse).getObjectByName('chronicles-campaign-town');
    const guards = town.getObjectByName('chronicles-town-street-upper-juliet-guards');
    expect(guards).toBeInstanceOf(THREE.InstancedMesh);
    expect(guards.count).toBe(8);
    expect(guards.userData.chroniclesDecorativeOnly).toBe(true);
    expect(guards.castShadow).toBe(false);
    expect(guards.frustumCulled).toBe(false);
    expect(guards.geometry.index.count).toBe(11 * 36); // Two rails, seven balusters, two returns.
    expect(guards.material.metalness).toBeCloseTo(0.48);
    const bounds = new THREE.Box3()
      .setFromBufferAttribute(guards.geometry.getAttribute('position'));
    expect(bounds.min.x).toBeGreaterThan(-0.81);
    expect(bounds.max.x).toBeLessThan(0.81);
    expect(bounds.min.z).toBeLessThan(-0.12); // Returns key into the solid wall.
    expect(bounds.max.z).toBeGreaterThan(0.15); // Rails project just beyond stucco.
    expect(3.96 + bounds.min.y).toBeGreaterThan(3.7); // Safe vertical clearance.
    expect(3.96 + bounds.max.y).toBeLessThan(4.45 + 0.02 - 0.26); // Below real glass.
    const expected = [[8, 16], [14, 16], [16, 16], [2, 18],
      [16, 18], [11, 19], [2, 20], [4, 20]];
    const matrix = new THREE.Matrix4();
    for (const [index, [x, y]] of expected.entries()) {
      guards.getMatrixAt(index, matrix);
      const pos = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(pos, rotation, scale);
      expect(pos.x).toBeCloseTo((x - 9) * 4);
      expect(pos.y).toBeCloseTo(3.96);
      expect(pos.z).toBeCloseTo((y - 11) * 4 + 2.07);
      for (const axis of scale.toArray()) expect(axis).toBeCloseTo(1);
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).z).toBeCloseTo(1);
      expect(swordhaven.grid[y][x]).toBe('#');
      expect(swordhaven.grid[y + 1][x]).toBe('.');
      expect((x * 3 + y * 5) % 8).toBeLessThan(3);
    }
    // No change to existing windows/hoods and no extra glow or gameplay props.
    expect(town.getObjectByName('chronicles-town-street-window-panes').count).toBe(
      town.getObjectByName('chronicles-town-street-oak-window-hoods').count);
  });

  it('never applies the Swordhaven-only streetscape to another settlement id', () => {
    const other = createStreetScene(true, 'other-authored-settlement');
    expect(other.getObjectByName('chronicles-town-street-window-frames')).toBeTruthy();
    expect(other.getObjectByName('chronicles-town-street-oak-window-hoods')).toBeFalsy();
    expect(other.getObjectByName('chronicles-town-street-terracotta-window-boxes')).toBeFalsy();
    expect(other.getObjectByName('chronicles-town-street-upper-juliet-guards')).toBeFalsy();
  });
});
