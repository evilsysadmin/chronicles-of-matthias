import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesRestorativeFountain3D } from './chroniclesRestorativeFountain3D.js';

describe('Restorative fountain in the first-person renderer', () => {
  it('is a real stone basin with a separable water surface, not a generic plaque', () => {
    const { group, water } = buildChroniclesRestorativeFountain3D();
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.name).toBe('chronicles-restorative-fountain');
    expect(group.getObjectByName('restorative-fountain-basin')).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName('restorative-fountain-basin').geometry)
      .toBeInstanceOf(THREE.LatheGeometry);
    expect(water.parent).toBe(group);
    expect(water.getObjectByName('restorative-fountain-pool')).toBeInstanceOf(THREE.Mesh);
    expect(water.children.filter((node) => node instanceof THREE.Mesh).length).toBeGreaterThanOrEqual(5);
    water.visible = false;
    expect(group.visible).toBe(true);
    expect(water.visible).toBe(false);
    expect(group.getObjectByName('restorative-fountain-basin').visible).toBe(true);
  });

  it('reduces tessellation and omits point light for touch devices', () => {
    const desktop = buildChroniclesRestorativeFountain3D();
    const mobile = buildChroniclesRestorativeFountain3D({ coarsePointer: true });
    expect(mobile.group.getObjectByName('restorative-fountain-basin').geometry.parameters.segments)
      .toBeLessThan(desktop.group.getObjectByName('restorative-fountain-basin').geometry.parameters.segments);
    expect(desktop.water.children.some((node) => node instanceof THREE.PointLight)).toBe(true);
    expect(mobile.water.children.some((node) => node instanceof THREE.PointLight)).toBe(false);
  });
});
