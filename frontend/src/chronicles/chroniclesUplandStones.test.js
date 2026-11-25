import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildTerraScenery, chroniclesOrganicRockGeometry } from './chroniclesTerraScenery.js';

const triangles = (geo) => (geo.index?.count || geo.getAttribute('position').count) / 3;

describe('native Terra upland stone', () => {
  it.each([[true, 20], [false, 80]])(
    'reuses the same %s-quality triangle budget with broad, asymmetric boulders',
    (coarsePointer, budget) => {
      const original = chroniclesOrganicRockGeometry({ coarsePointer });
      const rock = chroniclesOrganicRockGeometry({ coarsePointer, weatheredHighland: true });
      const repeated = chroniclesOrganicRockGeometry({ coarsePointer, weatheredHighland: true });
      expect(triangles(original)).toBe(budget);
      expect(triangles(rock)).toBe(budget);
      const p = rock.getAttribute('position');
      expect([...p.array]).toEqual([...repeated.getAttribute('position').array]);
      expect([...p.array]).not.toEqual([...original.getAttribute('position').array]);
      expect(rock.getAttribute('uv').count).toBe(p.count);
      expect(rock.getAttribute('normal').count).toBe(p.count);
      const size = rock.boundingBox.getSize(new THREE.Vector3());
      expect(size.y).toBeLessThan(size.x * 0.92);
      expect(size.y).toBeLessThan(size.z * 0.95);
      expect(rock.boundingSphere.radius).toBeLessThan(1.6);
      for (const attr of ['position', 'normal', 'uv']) {
        for (const n of rock.getAttribute(attr).array) expect(Number.isFinite(n)).toBe(true);
      }
      original.dispose();
      rock.dispose();
      repeated.dispose();
    },
  );

  it('gives the hills a muted, cached and mipmapped rock atlas without black checkerboard fissures', () => {
    const atlas = chroniclesPixelTexture('uplandrock');
    const oldRock = chroniclesPixelTexture('rock');
    expect(atlas).not.toBe(oldRock);
    expect(atlas).toBe(chroniclesPixelTexture('uplandrock'));
    expect(atlas.userData.chroniclesPixelArt).toMatchObject({ kind: 'uplandrock', size: 64 });
    expect(atlas.image.data.length).toBe(64 * 64 * 4);
    expect(atlas.wrapS).toBe(THREE.RepeatWrapping);
    expect(atlas.wrapT).toBe(THREE.RepeatWrapping);
    expect(atlas.magFilter).toBe(THREE.LinearFilter);
    expect(atlas.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(atlas.anisotropy).toBe(4);
    const shades = new Set();
    let minimumGreen = 255, maximumGreen = 0;
    for (let i = 0; i < atlas.image.data.length; i += 4) {
      const r = atlas.image.data[i], g = atlas.image.data[i + 1];
      const b = atlas.image.data[i + 2];
      expect(atlas.image.data[i + 3]).toBe(255);
      expect(r).toBeGreaterThanOrEqual(100);
      expect(g).toBeGreaterThanOrEqual(106);
      expect(b).toBeGreaterThanOrEqual(90);
      shades.add([r, g, b].join(','));
      minimumGreen = Math.min(minimumGreen, g);
      maximumGreen = Math.max(maximumGreen, g);
    }
    expect(shades.size).toBeGreaterThan(3);
    expect(maximumGreen - minimumGreen).toBeLessThan(90);
  });

  it('keeps one original instance batch per rock species with deterministic per-rock hues on E2', () => {
    const center = { x: 10, y: 7 };
    const plan = (mapId) => {
      const map = chroniclesMapById(mapId);
      return { grid: map.grid, mapId, biome: map.biome, scenery: map.scenery, center };
    };
    const e2 = buildTerraScenery(plan('terra-e2'));
    const e2Again = buildTerraScenery(plan('terra-e2'));
    const touch = buildTerraScenery({ ...plan('terra-e2'), coarsePointer: true });
    const b2 = buildTerraScenery(plan('terra-b2'));
    const c4 = buildTerraScenery(plan('terra-c4'));
    for (const part of ['boulder', 'crag', 'pebble']) {
      const name = 'chronicles-terra-' + part;
      const mesh = e2.getObjectByName(name), mobile = touch.getObjectByName(name);
      const replay = e2Again.getObjectByName(name);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mobile).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.material.map).toBe(chroniclesPixelTexture('uplandrock'));
      expect(mobile.material.map).toBe(mesh.material.map);
      expect(mesh.material.map).not.toBe(b2.getObjectByName(name).material.map);
      expect(b2.getObjectByName(name).material.map).toBe(chroniclesPixelTexture('rock'));
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.count).toBe(replay.count);
      expect(mesh.count).toBeGreaterThanOrEqual(mobile.count);
      expect(e2.children.filter(child => child.name === name)).toHaveLength(1);
      const m = new THREE.Matrix4(), twin = new THREE.Matrix4();
      const tint = new THREE.Color(), twinTint = new THREE.Color();
      const colors = new Set();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, m);
        replay.getMatrixAt(i, twin);
        expect(m.elements).toEqual(twin.elements);
        mesh.getColorAt(i, tint);
        replay.getColorAt(i, twinTint);
        expect(tint.getHex()).toBe(twinTint.getHex());
        colors.add(tint.getHex());
      }
      expect(mesh.instanceColor.count).toBe(mesh.count);
      expect(mobile.instanceColor.count).toBe(mobile.count);
      expect(colors.size).toBeGreaterThan(1);
    }
    expect(triangles(touch.getObjectByName('chronicles-terra-boulder').geometry)).toBe(20);
    expect(triangles(e2.getObjectByName('chronicles-terra-boulder').geometry)).toBe(80);
    expect(b2.getObjectByName('chronicles-terra-boulder').instanceColor).toBeTruthy();
    expect(c4.getObjectByName('chronicles-terra-boulder').material.map)
      .toBe(chroniclesPixelTexture('rock'));
    expect(c4.getObjectByName('chronicles-terra-boulder').instanceColor).toBeNull();
    expect(e2.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(touch.children.every(mesh => mesh.isInstancedMesh)).toBe(true);
    expect(e2.children.length).toBe(e2Again.children.length);
  });
});
