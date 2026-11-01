import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildChroniclesExteriorExit,
  chroniclesExteriorExitKind,
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
