import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesVolleyProjectileKinds,
  createChroniclesVolleyProjectileArt,
} from './chroniclesVolleyProjectileArt.js';

describe('Chronicles · physical missile family rendering (#134)', () => {
  const equippedParty = () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    return {
      ...base,
      equipment: {
        matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
        rook: { weapon: 'bronze-mace', missile: 'bronze-sling' },
        knight: { weapon: 'bronze-dagger', missile: 'bronze-crossbow' },
        bishop: { weapon: 'bronze-mace', missile: 'wooden-bow' },
      },
    };
  };

  it('resolves one shape per surviving, class-compatible shooter, without phantom arrows', () => {
    const state = equippedParty();
    expect(chroniclesVolleyProjectileKinds(state, ['matthias', 'rook', 'knight', 'bishop']))
      .toEqual(['bow', 'sling', 'crossbow']);
    expect(chroniclesVolleyProjectileKinds(state, ['knight', 'knight', 'matthias']))
      .toEqual(['crossbow', 'bow']);
    const fallen = {
      ...state, party: state.party.map((member) => (
        member.id === 'rook' ? { ...member, hp: 0 } : member
      )),
    };
    expect(chroniclesVolleyProjectileKinds(fallen, ['rook', 'knight'])).toEqual(['crossbow']);
    expect(chroniclesVolleyProjectileKinds(state, ['unknown'])).toEqual([]);
    expect(chroniclesVolleyProjectileKinds(state, null)).toEqual([]);
  });

  it('locks physical projectiles to the firing camera transform, never its later easing yaw', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    scene.add(camera);
    camera.position.set(3, 1.62, 8);
    camera.rotation.y = Math.PI / 3;
    const fx = createChroniclesVolleyProjectileArt(THREE, camera, scene);
    expect(fx.group.parent).toBe(scene);
    expect(fx.setFamilies(['bow', 'crossbow'])).toBe(2);
    // Party has already turned west, but camera easing still points east.
    const logicalYaw = -Math.PI / 4;
    fx.anchorLaunchPose(logicalYaw);
    expect(fx.group.getWorldQuaternion(new THREE.Quaternion())
      .angleTo(new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), logicalYaw,
      ))).toBeLessThan(0.000001);
    fx.projectiles[0].position.set(0, -0.33, -1.4);
    scene.updateMatrixWorld(true);
    const fixed = fx.projectiles[0].getWorldPosition(new THREE.Vector3());
    const launchOrientation = fx.group.getWorldQuaternion(new THREE.Quaternion());

    // A camera rotation after the shot must not bend an already launched arrow.
    camera.rotation.y = -Math.PI / 2;
    camera.position.set(11, 1.62, 3);
    scene.updateMatrixWorld(true);
    const after = fx.projectiles[0].getWorldPosition(new THREE.Vector3());
    expect(after.distanceTo(fixed)).toBeLessThan(0.000001);
    expect(fx.group.getWorldQuaternion(new THREE.Quaternion()).angleTo(launchOrientation))
      .toBeLessThan(0.000001);

    // A second legitimate salvo updates the anchor to the new camera pose.
    fx.anchorLaunchPose(Math.PI / 2);
    scene.updateMatrixWorld(true);
    expect(fx.group.getWorldQuaternion(new THREE.Quaternion())
      .angleTo(new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), Math.PI / 2,
      ))).toBeLessThan(0.000001);
    expect(fx.projectiles[0].getWorldPosition(new THREE.Vector3()).distanceTo(fixed))
      .toBeGreaterThan(1);
    expect(fx.group.getWorldQuaternion(new THREE.Quaternion()).angleTo(launchOrientation))
      .toBeGreaterThan(0.1);
  });

  it('switches between three genuinely distinct geometry families and clears old visual state', () => {
    const camera = new THREE.Group();
    const fx = createChroniclesVolleyProjectileArt(THREE, camera);
    expect(camera.children).toContain(fx.group);
    expect(fx.group.visible).toBe(false);
    expect(fx.setFamilies(['bow', 'crossbow', 'sling'])).toBe(3);
    expect(fx.group.visible).toBe(true);
    expect(fx.projectiles.filter((root) => root.visible)).toHaveLength(3);
    expect(fx.projectiles.slice(0, 3).map((root) => root.userData.volleyKind))
      .toEqual(['bow', 'crossbow', 'sling']);
    expect(fx.projectiles[0].getObjectByName('bow-shaft')?.visible).toBe(true);
    expect(fx.projectiles[0].getObjectByName('bow-head')?.geometry.type).toBe('ConeGeometry');
    expect(fx.projectiles[0].getObjectByName('bow-fletching-0')?.geometry.type).toBe('ShapeGeometry');
    expect(fx.projectiles[0].getObjectByName('bow-trail')?.material.transparent).toBe(true);
    expect(fx.projectiles[1].getObjectByName('crossbow-trail')).toBeTruthy();
    expect(fx.projectiles[2].getObjectByName('sling-trail')).toBeTruthy();
    expect(fx.projectiles[1].getObjectByName('crossbow-shaft')?.visible).toBe(true);
    expect(fx.projectiles[2].getObjectByName('sling-stone')?.geometry.type)
      .toBe('IcosahedronGeometry');
    expect(fx.projectiles[2].getObjectByName('bow-shaft')?.geometry.type)
      .toBe('CylinderGeometry');
    expect(fx.setFamilies(['sling'])).toBe(1);
    expect(fx.projectiles[0].userData.volleyVariants.sling.visible).toBe(true);
    expect(fx.projectiles[0].userData.volleyVariants.bow.visible).toBe(false);
    expect(fx.projectiles[1].visible).toBe(false);
    expect(fx.setFamilies([])).toBe(0);
    expect(fx.group.visible).toBe(false);
    expect(fx.setFamilies(Array(9).fill('crossbow'))).toBe(6);
  });
});
