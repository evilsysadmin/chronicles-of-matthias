import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesWitchCauldron3D } from './chroniclesWitchCauldron3D.js';

describe('MM3 witch cauldron premium world prop', () => {
  it('has a hollow iron vessel and a separate potion that can be drained', () => {
    const { group, contents } = buildChroniclesWitchCauldron3D();
    expect(group.name).toBe('chronicles-witch-cauldron');
    expect(contents.name).toBe('witch-cauldron-brew');
    expect(contents.parent).toBe(group);
    const bowl = group.getObjectByName('witch-cauldron-bowl');
    expect(bowl).toBeInstanceOf(THREE.Mesh);
    expect(bowl.geometry).toBeInstanceOf(THREE.LatheGeometry);
    expect(group.children.filter((part) => part instanceof THREE.Mesh).length).toBeGreaterThanOrEqual(7);
    expect(contents.getObjectByName('witch-cauldron-liquid')).toBeInstanceOf(THREE.Mesh);
    expect(contents.children.some((part) => part instanceof THREE.PointLight)).toBe(true);
    contents.visible = false;
    expect(group.visible).toBe(true);
    expect(bowl.visible).toBe(true);
    expect(contents.visible).toBe(false);
  });

  it('reduces geometry and avoids point lights on mobile without removing the readable silhouette', () => {
    const full = buildChroniclesWitchCauldron3D();
    const compact = buildChroniclesWitchCauldron3D({ coarsePointer: true });
    expect(compact.group.getObjectByName('witch-cauldron-bowl').geometry.parameters.segments)
      .toBeLessThan(full.group.getObjectByName('witch-cauldron-bowl').geometry.parameters.segments);
    expect(compact.contents.children.some((part) => part instanceof THREE.PointLight)).toBe(false);
    expect(compact.group.getObjectByName('witch-cauldron-bowl')).toBeTruthy();
    expect(compact.contents.getObjectByName('witch-cauldron-liquid')).toBeTruthy();
  });
});
