import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildChroniclesExteriorExit,
  chroniclesExteriorExitKind,
  chroniclesTownWallPassage,
  buildChroniclesTownWallOpening,
} from './chroniclesExteriorExitArt.js';

const destinations = {
  swordhaven: { id: 'swordhaven', regionKind: 'settlement' },
  crypt: { id: 'crypt', regionKind: 'dungeon' },
  rookwood: { id: 'rookwood', regionKind: 'wilderness', biome: 'forest' },
  moor: { id: 'moor', regionKind: 'wilderness', biome: 'hills' },
};
const exitTo = (mapId) => ({
  action: { effects: [{ type: 'transition-map', mapId }] },
});

describe('destination-aware exterior area thresholds', () => {
  it('uses destination metadata, never the biome of the current map', () => {
    const lookup = (id) => destinations[id];
    expect(chroniclesExteriorExitKind(exitTo('swordhaven'), lookup)).toBe('settlement');
    expect(chroniclesExteriorExitKind(exitTo('crypt'), lookup)).toBe('dungeon');
    expect(chroniclesExteriorExitKind(exitTo('rookwood'), lookup)).toBe('forest');
    expect(chroniclesExteriorExitKind(exitTo('moor'), lookup)).toBe('wilderness');
    expect(chroniclesExteriorExitKind(exitTo('missing'), lookup)).toBe('wilderness');
    expect(chroniclesExteriorExitKind({}, lookup)).toBe('wilderness');
    expect(chroniclesExteriorExitKind(exitTo('crypt'), () => destinations.swordhaven)).toBe('wilderness');
    expect(chroniclesExteriorExitKind(exitTo('moor'), lookup, { regionKind: 'settlement' })).toBe('settlement');
  });

  it.each(['settlement', 'dungeon', 'forest', 'wilderness'])(
    'builds an identifiable %s threshold without changing traversal', (style) => {
      const root = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial();
      const timber = new THREE.MeshStandardMaterial();
      const plaque = new THREE.MeshStandardMaterial();
      buildChroniclesExteriorExit(root, { style, stone, timber, plaque, coarsePointer: true });
      expect(root.userData.chroniclesExitGatewayStyle).toBe(style);
      expect(root.children.length).toBeGreaterThan(1);
      expect(root.getObjectByName('banner-road-heraldic-pennant')).toBeUndefined();
      expect(root.getObjectByName(style === 'forest'
        ? 'chronicles-exit-forest-canopy'
        : style === 'wilderness'
          ? 'chronicles-exit-wild-cairn'
          : 'chronicles-exit-gate-arch-stone')).toBeDefined();
      expect(root.children.every((child) => child.isMesh || child.isGroup)).toBe(true);
    },
  );

  it('keeps both fortified leaves visibly open and the wilderness path unbarred', () => {
    const palette = {
      stone: new THREE.MeshStandardMaterial(),
      timber: new THREE.MeshStandardMaterial(),
      plaque: new THREE.MeshStandardMaterial(),
    };
    const gate = buildChroniclesExteriorExit(new THREE.Group(), { ...palette, style: 'settlement' });
    const hinges = gate.children.filter((piece) => piece.name === 'chronicles-exit-gate-open-hinge');
    expect(hinges).toHaveLength(2);
    expect(hinges.every((hinge) => Math.abs(hinge.rotation.y) > 1)).toBe(true);
    const trail = buildChroniclesExteriorExit(new THREE.Group(), { ...palette, style: 'wilderness' });
    expect(trail.getObjectByName('chronicles-exit-gate-open-hinge')).toBeUndefined();
  });
});

describe('walled city exits', () => {
  const grid = [
    '#########',
    '#.......#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#########',
  ];
  const exit = (x, y, visualType = 'exit') => ({
    kind: 'exit', visualType, position: { x, y },
  });

  it('identifies only valid border transitions and never a sewer grate', () => {
    expect(chroniclesTownWallPassage(exit(4, 1), grid))
      .toMatchObject({ wallX: 4, wallY: 0, yaw: 0 });
    expect(chroniclesTownWallPassage(exit(7, 3), grid))
      .toMatchObject({ wallX: 8, wallY: 3, yaw: -Math.PI / 2 });
    expect(chroniclesTownWallPassage(exit(4, 5), grid))
      .toMatchObject({ wallX: 4, wallY: 6, yaw: Math.PI });
    expect(chroniclesTownWallPassage(exit(1, 3), grid))
      .toMatchObject({ wallX: 0, wallY: 3, yaw: Math.PI / 2 });
    expect(chroniclesTownWallPassage(exit(4, 3), grid)).toBeNull();
    expect(chroniclesTownWallPassage(exit(4, 1, 'sewer-grate'), grid)).toBeNull();
  });

  it('leaves a physical gap in the rendered masonry mesh, with a high lintel', () => {
    const root = buildChroniclesTownWallOpening(new THREE.Group(), {
      wallHeight: 6.4, stone: new THREE.MeshStandardMaterial(),
    });
    const jambs = root.children.filter((item) => item.name === 'chronicles-town-gate-wall-jamb');
    const lintels = root.children.filter((item) => item.name === 'chronicles-town-gate-wall-lintel');
    expect(jambs).toHaveLength(2);
    expect(lintels).toHaveLength(1);
    expect(jambs[0].position.x).toBeLessThan(-1);
    expect(jambs[1].position.x).toBeGreaterThan(1);
    expect(lintels[0].position.y).toBeGreaterThan(4);
    expect(root.userData.chroniclesTownGateOpeningWidth).toBe(2.56);
  });
});
