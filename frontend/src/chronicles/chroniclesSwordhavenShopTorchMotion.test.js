import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene, SWORDHAVEN_BUILDINGS } from './chroniclesSwordhaven3D.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import { createChroniclesExteriorDaylight } from './chroniclesExteriorDaylight.js';
import { animateSwordhavenShopTorches } from './chroniclesSwordhavenShopTorches.js';
import swordhaven from './maps/swordhaven-first-book.json';

function fireFrom(scene) {
  const plaque = scene.getObjectByName('swordhaven-shop-nameplate');
  return {
    plaque,
    flames: plaque.getObjectByName('shop-sign-torch-flames'),
    wash: plaque.parent.getObjectByName('shop-sign-torch-wallwash'),
  };
}

describe('Swordhaven animated, sheltered shop fires', () => {
  it.each([true, false])('animates both brazier tongues independently without rebuilding geometry (coarse=%s)', (coarsePointer) => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer });
    const building = scene.getObjectByName('swordhaven-building-' + SWORDHAVEN_BUILDINGS[0].id);
    const { flames, wash } = fireFrom(building);
    const outer = flames.getObjectByName('shop-sign-torch-outer-flame');
    const inner = flames.getObjectByName('shop-sign-torch-inner-flame');
    const hood = building.getObjectByName('shop-sign-torch-hoods');
    const mount = building.getObjectByName('shop-sign-torch-sconces');
    const outerPositions = outer.geometry.getAttribute('position');
    const innerPositions = inner.geometry.getAttribute('position');
    const outerArray = outerPositions.array;
    const innerArray = innerPositions.array;
    const outerRest = [...outerArray];
    const innerRest = [...innerArray];
    const roofMatrix = hood.matrix.clone();
    const mountMatrix = mount.matrix.clone();
    const children = flames.children.length;

    flames.visible = true;
    flames.userData.chroniclesFireStrength = 1;
    expect(animateSwordhavenShopTorches(flames, wash, 0.2)).toBe(true);
    expect([...outerArray]).not.toEqual(outerRest);
    expect([...innerArray]).not.toEqual(innerRest);
    const firstFrame = [...outerArray];
    expect(animateSwordhavenShopTorches(flames, wash, 0.55)).toBe(true);
    expect([...outerArray]).not.toEqual(firstFrame);
    expect(outer.geometry.getAttribute('position')).toBe(outerPositions);
    expect(inner.geometry.getAttribute('position')).toBe(innerPositions);
    expect(outerPositions.array).toBe(outerArray);
    expect(innerPositions.array).toBe(innerArray);
    expect(flames.children).toHaveLength(children);
    expect(hood.matrix.equals(roofMatrix)).toBe(true);
    expect(mount.matrix.equals(mountMatrix)).toBe(true);

    // Left and right flames must not oscillate in lockstep. Their roots stay
    // attached to the iron cups, while only upper flame tips drift.
    const rest = outer.userData.chroniclesFireRestPositions;
    const low = [], high = [], left = [], right = [];
    for (let i = 0; i < rest.length; i += 3) {
      const delta = Math.abs(outerArray[i] - rest[i]);
      const height = rest[i + 1] - 0.205;
      if (height < 0.008) low.push(delta);
      if (height > 0.25) high.push(delta);
      if (height > 0.25) (rest[i] < 0 ? left : right).push(outerArray[i] - rest[i]);
    }
    expect(Math.max(...low)).toBeLessThan(0.00001);
    expect(Math.max(...high)).toBeGreaterThan(0.005);
    expect(left[0]).not.toBeCloseTo(right[0], 4);
    expect(flames.userData.outerFire.opacity).toBeGreaterThan(0.7);
    expect(wash.material.opacity).toBeGreaterThan(0.4);
    const secondFrame = [...outerArray];
    animateSwordhavenShopTorches(flames, wash, 0.55);
    expect([...outerArray]).toEqual(secondFrame); // time based, no cumulative distortion

    flames.visible = false;
    expect(animateSwordhavenShopTorches(flames, wash, 0.85)).toBe(false);
    expect([...outerArray]).toEqual(secondFrame);
  });

  it.each([true, false])('activates motion budget only near lit shop signs and not in daylight (coarse=%s)', (coarsePointer) => {
    const scene = new THREE.Scene();
    const grid = swordhaven.grid;
    buildChroniclesCampaignExterior(scene, {
      coarsePointer,
      scenePlan: {
        mapId: swordhaven.id, regionKind: 'settlement',
        width: grid[0].length, height: grid.length, center: { x: 9, y: 7 },
        grid, landscape: swordhaven.landscape,
        content: swordhaven.interactables
          .filter(entry => String(entry.visualType || '').startsWith('building-'))
          .map(entry => ({ ...entry, position: { x: entry.x, y: entry.y } })),
      },
    });
    const control = createChroniclesExteriorDaylight(scene, { toneMappingExposure: 1.08 }, {
      mapId: swordhaven.id, regionKind: 'settlement',
    });
    const { plaque, flames, wash } = fireFrom(scene);
    const atSign = plaque.getWorldPosition(new THREE.Vector3());
    const farAway = { x: atSign.x + 500, z: atSign.z + 500 };
    control.sync(8 * 60);
    expect(control.hasNearbyLitShopTorches(atSign)).toBe(false);
    control.sync(22 * 60);
    expect(flames.visible).toBe(true);
    expect(control.hasNearbyLitShopTorches(atSign)).toBe(true);
    expect(control.hasNearbyLitShopTorches(farAway)).toBe(false);
    expect(control.hasNearbyLitShopTorches(null)).toBe(false);
    const outer = flames.getObjectByName('shop-sign-torch-outer-flame');
    const positions = [...outer.geometry.getAttribute('position').array];
    control.animateShopTorches(0.37);
    expect([...outer.geometry.getAttribute('position').array]).not.toEqual(positions);
    expect(wash.material.opacity).toBeGreaterThan(0);
    control.sync(8 * 60);
    expect(flames.visible).toBe(false);
    expect(wash.visible).toBe(false);
    expect(control.hasNearbyLitShopTorches(atSign)).toBe(false);
    const afterDay = [...outer.geometry.getAttribute('position').array];
    control.animateShopTorches(0.73);
    expect([...outer.geometry.getAttribute('position').array]).toEqual(afterDay);
  });
});
