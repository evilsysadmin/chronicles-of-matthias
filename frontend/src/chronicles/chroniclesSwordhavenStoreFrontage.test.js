import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  swordhavenSurfaceTexture, swordhavenSurfaceNormalTexture,
} from './chroniclesSwordhaven3D.js';
import swordhaven from './maps/swordhaven-first-book.json';

describe('Swordhaven general store frontage', () => {
  it.each([true, false])('keeps oak market bays decorative on coarsePointer=%s', (coarsePointer) => {
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
    const store = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-store-'));
    const forge = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-forge-'));
    expect(store).toBeTruthy();
    expect(forge).toBeTruthy();
    const tavern = town.children.find(child =>
      child.name.startsWith('swordhaven-building-first-book-tavern-'));
    // The warehouse stocks provisions in crates, not the inn's decorative flowers.
    // All crates remain on the original raised facade displays on touch/desktop.
    const crates = store.getObjectByName('store-window-provisions-crates');
    const braces = store.getObjectByName('store-window-crate-crossbraces');
    expect(crates?.count).toBe(4);
    expect(braces?.count).toBe(8);
    expect(crates.userData.chroniclesDecorativeOnly).toBe(true);
    expect(braces.userData.chroniclesDecorativeOnly).toBe(true);
    expect(store.children.filter(child => child.name === 'store-stock-display-trough'))
      .toHaveLength(2);
    expect(store.getObjectByName('flower-window-box')).toBeFalsy();
    expect(store.getObjectByName('window-box-blooms')).toBeFalsy();
    expect(tavern.getObjectByName('window-box-blooms')).toBeTruthy();
    expect(forge.getObjectByName('store-window-provisions-crates')).toBeFalsy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    const walls = store.getObjectByName('timber-and-stone-walls');
    expect(walls.material.color.getHex()).toBe(0xd9b98a);
    expect(walls.material.map).toBe(swordhavenSurfaceTexture('stucco'));
    expect(walls.material.normalMap).toBe(swordhavenSurfaceNormalTexture('stucco'));
    expect(store.getObjectByName('roof-gable-1').material).toBe(walls.material);
    expect(store.getObjectByName('roof-gable--1').material).toBe(walls.material);
    expect(forge.getObjectByName('timber-and-stone-walls').material.color.getHex())
      .not.toBe(walls.material.color.getHex());
    // A cedar-clad warehouse roof must read differently from the tavern's
    // ceramic tiles in both desktop and coarse/touch rendering.
    for (const side of [-1, 1]) {
      const storeRoof = store.getObjectByName('pitched-roof-' + side);
      const tavernRoof = tavern.getObjectByName('pitched-roof-' + side);
      expect(storeRoof.material.color.getHex()).toBe(0x8c7357);
      expect(storeRoof.material.map).toBe(swordhavenSurfaceTexture('timber'));
      expect(storeRoof.material.normalMap).toBeNull();
      expect(tavernRoof.material.map).toBe(swordhavenSurfaceTexture('roof'));
      expect(tavernRoof.material.normalMap).toBe(swordhavenSurfaceNormalTexture('roof'));
      expect(storeRoof.getObjectByName('pitched-roof-shingle-seams')?.count)
        .toBe(coarsePointer ? 7 : 12);
    }
    const frontage = store.getObjectByName('store-oak-frontage');
    expect(frontage?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(frontage.children.filter(child => child.name === 'store-oak-panel')).toHaveLength(2);
    expect(frontage.children.filter(child => child.name === 'store-oak-batten')).toHaveLength(6);
    expect(frontage.children.filter(child => child.name === 'store-oak-rail')).toHaveLength(2);
    expect(forge.getObjectByName('store-oak-frontage')).toBeFalsy();
    // Ground-floor provisions sacks are a decorative, batched stock display
    // outside the oak bays, never a new obstacle or an obscured entrance.
    const sacks = store.getObjectByName('store-front-provisions-sacks');
    expect(sacks?.count).toBe(4);
    expect(sacks.userData.chroniclesDecorativeOnly).toBe(true);
    expect(sacks.geometry.type).toBe('LatheGeometry');
    const profile = sacks.geometry.parameters.points;
    expect(Math.max(...profile.map(point => point.x))).toBeGreaterThan(profile[0].x);
    expect(profile.at(-2).x).toBeLessThan(profile[3].x);
    // The stock must read as creased canvas rather than round pottery, on
    // both coarse and desktop geometry without adding individual draw calls.
    const sackVertices = sacks.geometry.getAttribute('position');
    const sackTints = sacks.geometry.getAttribute('color');
    expect(sacks.material.vertexColors).toBe(true);
    expect(sackTints?.count).toBe(sackVertices.count);
    const waistRadii = [];
    for (let vertex = 0; vertex < sackVertices.count; vertex += 1) {
      if (Math.abs(sackVertices.getY(vertex) - 0.43) < 0.001) {
        waistRadii.push(Math.hypot(sackVertices.getX(vertex), sackVertices.getZ(vertex) / 0.9));
      }
    }
    expect(Math.max(...waistRadii) - Math.min(...waistRadii)).toBeGreaterThan(0.03);
    const ties = store.getObjectByName('store-front-sack-twine');
    expect(ties?.count).toBe(4);
    expect(ties.userData.chroniclesDecorativeOnly).toBe(true);
    const creases = store.getObjectByName('store-front-sack-cloth-creases');
    expect(creases?.count).toBe(4);
    expect(creases.geometry.type).toBe('TubeGeometry');
    expect(creases.userData.chroniclesDecorativeOnly).toBe(true);
    expect(forge.getObjectByName('store-front-sack-cloth-creases')).toBeFalsy();
    expect(forge.getObjectByName('store-front-sack-twine')).toBeFalsy();
    expect(forge.getObjectByName('store-front-provisions-sacks')).toBeFalsy();
    const sackTransform = new THREE.Object3D();
    for (let index = 0; index < sacks.count; index += 1) {
      sacks.getMatrixAt(index, sackTransform.matrix);
      sackTransform.matrix.decompose(sackTransform.position, sackTransform.quaternion, sackTransform.scale);
      expect(Math.abs(sackTransform.position.x)).toBeGreaterThan(1.75);
      // Lathe profile starts at the ground (unlike the old centred cylinder).
      expect(sackTransform.position.y).toBeGreaterThan(0);
      expect(sackTransform.position.y + profile.at(-1).y * sackTransform.scale.y)
        .toBeGreaterThan(0.8);
      expect(sackTransform.position.z).toBeLessThan(5.5);
    }
    const loft = store.getObjectByName('store-merchant-loft');
    expect(loft?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(loft.getObjectByName('store-loft-oak-gable')).toBeTruthy();
    expect(loft.getObjectByName('store-loft-window')).toBeTruthy();
    // The loft window must project in front of the main gable to be visible
    // from the street-facing camera, not merely exist in the scene graph.
    expect(loft.position.z + 0.77).toBeGreaterThan(store.getObjectByName('roof-gable-1').position.z);
    expect(loft.children.filter(child => child.name === 'store-loft-roof-slope')).toHaveLength(2);
    const balcony = loft.getObjectByName('store-loft-loading-balcony');
    expect(balcony?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(balcony.children.filter(child => child.name === 'store-balcony-loading-deck'))
      .toHaveLength(1);
    expect(balcony.children.filter(child => child.name === 'store-balcony-side-rail'))
      .toHaveLength(2);
    expect(balcony.children.filter(child => child.name === 'store-balcony-front-rail'))
      .toHaveLength(2);
    expect(balcony.children.filter(child => child.name === 'store-balcony-diagonal-brace'))
      .toHaveLength(2);
    // The cargo deck projects beyond the attic window and stays high above
    // the street; it must never introduce a ground-level obstruction.
    const deck = balcony.getObjectByName('store-balcony-loading-deck');
    expect(deck.position.z).toBeGreaterThan(loft.getObjectByName('store-loft-window').position.z);
    expect(loft.position.y + deck.position.y - 0.09).toBeGreaterThan(4.5);
    expect(forge.getObjectByName('store-loft-loading-balcony')).toBeFalsy();
    expect(store.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    expect(store.getObjectByName('pitched-roof-dormer-1')).toBeFalsy();
    expect(forge.getObjectByName('store-merchant-loft')).toBeFalsy();
    expect(forge.getObjectByName('forge-roof-smoke-lantern')).toBeTruthy();
    expect(forge.getObjectByName('pitched-roof-dormer--1')).toBeFalsy();
    const awning = store.getObjectByName('store-market-awning');
    expect(awning?.userData.chroniclesDecorativeOnly).toBe(true);
    const hems = awning.children.filter(child => child.name === 'store-awning-scalloped-hem');
    expect(hems).toHaveLength(2);
    expect(hems.every(hem => hem.isInstancedMesh && hem.count === 3)).toBe(true);
    expect(hems.every(hem => hem.userData.chroniclesDecorativeOnly)).toBe(true);
    expect(hems[0].geometry).toBe(hems[1].geometry);
    expect(hems[0].material.color.getHex()).not.toBe(hems[1].material.color.getHex());
    const hemPosition = new THREE.Matrix4();
    hems[0].getMatrixAt(0, hemPosition);
    expect(new THREE.Vector3().setFromMatrixPosition(hemPosition).z)
      .toBeGreaterThan(awning.getObjectByName('store-awning-front-rail').position.z);
    // The shop is parented under the rotated/translated town; update ancestor
    // transforms before checking world-space clearance above the street.
    store.updateWorldMatrix(true, true);
    const hemBounds = new THREE.Box3().setFromObject(hems[0]);
    expect(hemBounds.min.y).toBeGreaterThan(2.7);
    const awningBraces = awning.children.filter(child =>
      child.name === 'store-awning-diagonal-support');
    expect(awningBraces).toHaveLength(2);
    expect(awningBraces[0].position.x).toBeCloseTo(-awningBraces[1].position.x);
    expect(awningBraces.every(brace => brace.rotation.x < -0.4)).toBe(true);
    expect(forge.getObjectByName('store-awning-scalloped-hem')).toBeFalsy();
    expect(store.getObjectByName('shop-door')).toBeTruthy();
    const storeNameplate = store.getObjectByName('swordhaven-shop-nameplate');
    expect(storeNameplate?.userData.shopLabel).toBe('PROVISIONES');
    expect(forge.getObjectByName('swordhaven-shop-nameplate')?.userData.shopLabel)
      .toBe('ARMERIA');
    // Warehouse side framing reads as exposed structural cedar without
    // covering the existing hatches or adding any physical obstacles.
    const sideFrame = store.getObjectByName('store-warehouse-side-frame');
    const posts = sideFrame?.getObjectByName('store-side-cedar-uprights');
    const rails = sideFrame?.getObjectByName('store-side-cedar-rails');
    expect(sideFrame?.userData.chroniclesDecorativeOnly).toBe(true);
    expect(posts?.isInstancedMesh && posts.count === 6).toBe(true);
    expect(rails?.isInstancedMesh && rails.count === 4).toBe(true);
    expect(posts.userData.chroniclesDecorativeOnly).toBe(true);
    expect(rails.userData.chroniclesDecorativeOnly).toBe(true);
    expect(posts.castShadow).toBe(!coarsePointer);
    expect(rails.castShadow).toBe(!coarsePointer);
    const transform = new THREE.Matrix4();
    const postPositions = [];
    for (let index = 0; index < posts.count; index += 1) {
      posts.getMatrixAt(index, transform);
      postPositions.push(new THREE.Vector3().setFromMatrixPosition(transform));
    }
    expect(postPositions.filter(position => Math.abs(position.z) < 0.01)).toHaveLength(2);
    expect(postPositions.every(position => Math.abs(position.x) > 4.0)).toBe(true);
    expect(postPositions.every(position => position.y > 2.0)).toBe(true);
    const railHeights = [];
    for (let index = 0; index < rails.count; index += 1) {
      rails.getMatrixAt(index, transform);
      railHeights.push(new THREE.Vector3().setFromMatrixPosition(transform).y);
    }
    expect(railHeights.filter(y => y < 2)).toHaveLength(2);
    expect(railHeights.filter(y => y > 4)).toHaveLength(2);
    expect(forge.getObjectByName('store-warehouse-side-frame')).toBeFalsy();
    // No authored map tiles or interaction contracts are changed.
    expect(swordhaven.grid[4][5]).toBe('.');
  });
});
