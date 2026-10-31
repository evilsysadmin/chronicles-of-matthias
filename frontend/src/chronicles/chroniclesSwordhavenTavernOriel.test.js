import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven tavern east guest oriel', () => {
  it.each([true, false])('keeps its projecting upper-floor bay decorative on coarsePointer=%s', (coarsePointer) => {
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
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    const oriel = tavern?.getObjectByName('tavern-east-guest-oriel');
    expect(oriel?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-guest-window'))
      .toHaveLength(2);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-corner-post'))
      .toHaveLength(2);
    expect(oriel.children.filter(child => child.name === 'tavern-oriel-diagonal-support'))
      .toHaveLength(2);
    const pitches = oriel.children.filter(child =>
      child.name === 'tavern-oriel-pitched-roof-slope');
    expect(pitches).toHaveLength(2);
    expect(pitches[0].position.z).toBeCloseTo(-pitches[1].position.z);
    expect(pitches[0].rotation.x).toBeCloseTo(-pitches[1].rotation.x);
    expect(Math.abs(pitches[0].rotation.x)).toBeGreaterThan(0.40);
    expect(pitches.every(pitch => pitch.castShadow === !coarsePointer)).toBe(true);
    const brickGable = oriel.getObjectByName('tavern-oriel-east-brick-gable');
    expect(brickGable).toBeInstanceOf(THREE.Mesh);
    expect(brickGable.geometry).toBeInstanceOf(THREE.ShapeGeometry);
    expect(brickGable.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(brickGable.material.map).toBeTruthy();
    const rakes = oriel.children.filter(child => child.name === 'tavern-oriel-east-oak-rake');
    expect(rakes).toHaveLength(2);
    expect(rakes[0].rotation.x).toBeCloseTo(-rakes[1].rotation.x);
    expect(oriel.getObjectByName('tavern-oriel-east-amber-roundel')).toBeTruthy();
    expect(oriel.getObjectByName('tavern-oriel-east-oak-roundel-frame')).toBeTruthy();
    const ridge = oriel.getObjectByName('tavern-oriel-roof-ridge');
    expect(ridge).toBeTruthy();
    expect(ridge.position.y).toBeGreaterThan(pitches[0].position.y);
    expect(oriel.getObjectByName('tavern-oriel-sloped-roof')).toBeFalsy();
    const gallery = oriel.getObjectByName('tavern-east-guest-gallery');
    expect(gallery).toBeInstanceOf(THREE.Group);
    expect(gallery.userData.chroniclesDecorativeOnly).toBe(true);
    const deck = gallery.getObjectByName('tavern-gallery-oak-deck');
    const toprail = gallery.getObjectByName('tavern-gallery-oak-toprail');
    const lowerrail = gallery.getObjectByName('tavern-gallery-lowerrail');
    const balusters = gallery.getObjectByName('tavern-gallery-carved-balusters');
    const supports = gallery.getObjectByName('tavern-gallery-knee-supports');
    const finials = gallery.getObjectByName('tavern-oriel-brass-roof-finials');
    expect([deck, toprail, lowerrail].every(part =>
      part?.isMesh && part.castShadow === !coarsePointer)).toBe(true);
    expect(gallery.children.filter(part => part.name === 'tavern-gallery-end-rail')).toHaveLength(2);
    expect(balusters).toBeInstanceOf(THREE.InstancedMesh);
    expect(balusters.count).toBe(7);
    expect(supports.count).toBe(2);
    expect(finials.count).toBe(2);
    expect(gallery.children.every(child => child.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(balusters.castShadow).toBe(!coarsePointer);
    expect(supports.castShadow).toBe(!coarsePointer);
    // The top rail ends beneath the real amber panes; no opaque railing
    // should cross the guest windows, door or shop nameplate.
    const guestPane = oriel.getObjectByName('tavern-oriel-guest-window');
    expect(toprail.position.y + toprail.geometry.parameters.height / 2)
      .toBeLessThan(guestPane.position.y - guestPane.geometry.parameters.height / 2);
    expect(deck.position.y).toBeLessThan(guestPane.position.y - 0.5);
    expect(finials.geometry.parameters.height).toBeLessThanOrEqual(0.30);
    expect(tavern.getObjectByName('shop-nameplate-lettering')).toBeTruthy();
    expect(forge.getObjectByName('tavern-east-guest-gallery')).toBeFalsy();
    // The upper bay projects from the east wall, but remains inside the
    // pre-existing three-cell-wide solid footprint, above ground-level windows.
    const bounds = new THREE.Box3().setFromObject(oriel);
    const localBounds = bounds.clone().applyMatrix4(tavern.matrixWorld.clone().invert());
    // The north-facing tavern is rotated PI: local -X is the east
    // plaza-facing side. Guard against a gallery hidden on the back wall.
    expect(tavern.rotation.y).toBeCloseTo(Math.PI);
    expect(oriel.position.x).toBeLessThan(-4.05);
    expect(localBounds.min.x).toBeLessThan(-4.05);
    expect(localBounds.min.x).toBeGreaterThan(-6);
    expect(localBounds.min.y).toBeGreaterThan(3);
    expect(tavern.getObjectByName('side-window-amber-glass')).toBeTruthy();
    expect(tavern.getObjectByName('shop-door')).toBeTruthy();
    // Both ground-floor guest windows have real, open oak shutters. The
    // batches remain decorative and outside the existing amber panes.
    const shutters = tavern.getObjectByName('tavern-inn-oak-shutters');
    expect(shutters).toBeInstanceOf(THREE.Group);
    expect(shutters.userData.chroniclesDecorativeOnly).toBe(true);
    const panels = shutters.getObjectByName('tavern-oak-shutter-panel');
    const hinges = shutters.getObjectByName('tavern-shutter-iron-hinges');
    const braces = shutters.getObjectByName('tavern-shutter-oak-brace');
    expect(panels).toBeInstanceOf(THREE.InstancedMesh);
    expect(panels.count).toBe(4);
    expect(hinges.count).toBe(8);
    expect(braces.count).toBe(4);
    expect([panels, hinges, braces].every(batch =>
      batch.userData.chroniclesDecorativeOnly && batch.castShadow === !coarsePointer))
      .toBe(true);
    const instance = new THREE.Matrix4();
    const positions = [];
    for (let i = 0; i < panels.count; i += 1) {
      panels.getMatrixAt(i, instance);
      positions.push(new THREE.Vector3().setFromMatrixPosition(instance));
    }
    expect(positions[0].x).toBeCloseTo(-positions[3].x);
    expect(positions[1].x).toBeCloseTo(-positions[2].x);
    expect(positions.every(position =>
      Math.abs(position.x) > 1.40 && Math.abs(position.x) < 4.05
      && position.y > 2.10 && position.y < 3.40)).toBe(true);
    expect(forge.getObjectByName('tavern-inn-oak-shutters')).toBeFalsy();
    const sideShutters = tavern.getObjectByName('tavern-side-oak-shutters');
    expect(sideShutters).toBeInstanceOf(THREE.InstancedMesh);
    expect(sideShutters.count).toBe(8);
    expect(sideShutters.userData.chroniclesDecorativeOnly).toBe(true);
    expect(sideShutters.castShadow).toBe(!coarsePointer);
    const sidePositions = [];
    for (let i = 0; i < sideShutters.count; i += 1) {
      sideShutters.getMatrixAt(i, instance);
      sidePositions.push(new THREE.Vector3().setFromMatrixPosition(instance));
    }
    expect(sidePositions.every(position =>
      Math.abs(position.x) > 4.05 && Math.abs(position.x) < 4.60
      && position.y > 2.10 && position.y < 3.60)).toBe(true);
    expect(forge.getObjectByName('tavern-side-oak-shutters')).toBeFalsy();
    expect(tavern.getObjectByName('tavern-double-hearth')).toBeTruthy();
    expect(forge?.getObjectByName('tavern-east-guest-oriel')).toBeFalsy();
    expect(swordhaven.grid[10][7]).toBe('.');
    expect(swordhaven.grid[12][7]).toBe('#');
  });
});
