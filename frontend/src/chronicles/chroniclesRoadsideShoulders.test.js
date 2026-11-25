import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { buildChroniclesCampaignExterior } from './chroniclesCampaignExterior3D.js';
import {
  chroniclesRoadsideShoulderGeometry, createBannerRoadShoulders,
} from './chroniclesRoadsideShoulders.js';

const map = chroniclesMapById('banner-road-first-book');
const center = { x: 10, y: 7 };
const roadCells = map.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
  tile === '.' && (x === center.x || y === center.y) ? [{ x, y }] : []));
const exposed = roadCells.flatMap(({ x, y }) =>
  [[0, 1], [1, 0], [0, -1], [-1, 0]].flatMap(([dx, dy]) =>
    map.grid[y + dy]?.[x + dx] !== undefined
      && !roadCells.some(cell => cell.x === x + dx && cell.y === y + dy)
      ? [{ x, y, dx, dy }] : []));

describe('Banner Road organic grass/earth shoulders', () => {
  it('dresses only outer paved edges and never creates a wall or collider', () => {
    const args = { grid: map.grid, roadCells, center };
    const full = createBannerRoadShoulders(args);
    const mobile = createBannerRoadShoulders({ ...args, coarsePointer: true });
    const again = createBannerRoadShoulders(args);
    expect(full).toBeInstanceOf(THREE.InstancedMesh);
    expect(full.count).toBe(exposed.length);
    expect(mobile.count).toBe(exposed.length);
    expect(full.count).toBeGreaterThan(25);
    expect(full.name).toBe('chronicles-banner-road-shoulders');
    expect(full.material.vertexColors).toBe(true);
    expect(full.material.transparent).toBe(true);
    expect(full.material.forceSinglePass).toBe(true);
    expect(full.material.depthWrite).toBe(false);
    expect(full.castShadow).toBe(false);
    expect(full.instanceColor.count).toBe(full.count);

    const m = new THREE.Matrix4();
    const twin = new THREE.Matrix4();
    const tint = new THREE.Color();
    const sameTint = new THREE.Color();
    const mapped = new Set();
    for (let i = 0; i < full.count; i += 1) {
      full.getMatrixAt(i, m);
      again.getMatrixAt(i, twin);
      expect(m.elements).toEqual(twin.elements);
      full.getColorAt(i, tint);
      again.getColorAt(i, sameTint);
      expect(tint.getHex()).toBe(sameTint.getHex());
      const matching = exposed.filter(({ x, y, dx, dy }) => {
        const side = (x === center.x && y !== center.y && dx !== 0)
          || (y === center.y && x !== center.x && dy !== 0);
        const edge = side ? 1.34 : 2.02;
        return Math.abs(m.elements[12] - ((x - center.x) * 4 + dx * edge)) < 0.001
          && Math.abs(m.elements[14] - ((y - center.y) * 4 + dy * edge)) < 0.001;
      });
      expect(matching).toHaveLength(1);
      const e = matching[0];
      mapped.add(e.x + ',' + e.y + ':' + e.dx + ',' + e.dy);
      expect(map.grid[e.y][e.x]).toBe('.');
      expect(roadCells.some(r => r.x === e.x + e.dx && r.y === e.y + e.dy)).toBe(false);
    }
    expect(mapped.size).toBe(exposed.length);
    // Paving ends 1.32m from the straight centreline; 1.34m shoulder
    // offsets let moss begin at the edge while keeping the walkable lane.
    expect(full.geometry.boundingBox.min.z).toBeGreaterThan(-0.12);
    expect(full.geometry.boundingBox.min.z).toBeLessThan(-0.095);
    expect(mobile.geometry.boundingBox.max.y).toBeLessThan(0.25);
    // The visible dirt tread must have a ragged, thin surface-level fringe,
    // not just moss triangles buried below its top. The raised road's top
    // is 0.0245m; 0.085 - 0.052 = 0.033m at these shoulder instances.
    for (const [mesh, count] of [[full, 8], [mobile, 4]]) {
      const positions = mesh.geometry.getAttribute('position');
      const tipDepths = [];
      let aprons = 0;
      for (let i = 0; i < positions.count; i += 3) {
        if (![0, 1, 2].every(k => Math.abs(positions.getY(i + k) - 0.085) < 1e-5)) continue;
        aprons += 1;
        const xs = [positions.getX(i), positions.getX(i + 1), positions.getX(i + 2)];
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(count === 4 ? 0.51 : 0.26);
        tipDepths.push(Math.min(positions.getZ(i), positions.getZ(i + 1), positions.getZ(i + 2)));
      }
      expect(aprons).toBe(count);
      expect(tipDepths.every(depth => depth < -0.06 && depth > -0.12)).toBe(true);
      expect(new Set(tipDepths.map(depth => Math.round(depth * 100))).size).toBeGreaterThan(2);
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(0, matrix);
      expect(matrix.elements[13] + 0.085).toBeGreaterThan(0.0245);
      expect(matrix.elements[13] + 0.085).toBeLessThan(0.045);
    }
  });

  it.each([true, false])('aligns four terminal shoulders with the real end of the narrow road (coarse=%s)', coarsePointer => {
    const mesh = createBannerRoadShoulders({ grid: map.grid, roadCells, center, coarsePointer });
    const positions = mesh.geometry.getAttribute('position');
    const m = new THREE.Matrix4(), world = new THREE.Vector3();
    let terminalCount = 0;
    for (const [i, edge] of exposed.entries()) {
      const { x, y, dx, dy } = edge;
      const terminal = (x === center.x && y !== center.y && dy !== 0)
        || (y === center.y && x !== center.x && dx !== 0);
      if (!terminal) continue;
      terminalCount++;
      mesh.getMatrixAt(i, m);
      const cx = (x - center.x) * 4, cz = (y - center.y) * 4;
      expect((m.elements[12] - cx) * dx + (m.elements[14] - cz) * dy).toBeCloseTo(2.02, 5);
      for (let v = 0; v < positions.count; v++) {
        world.fromBufferAttribute(positions, v).applyMatrix4(m);
        const lateral = Math.abs((world.x - cx) * dy - (world.z - cz) * dx);
        const longitudinal = (world.x - cx) * dx + (world.z - cz) * dy;
        expect(lateral).toBeLessThan(1.32);
        expect(longitudinal).toBeGreaterThan(1.88);
      }
    }
    expect(terminalCount).toBe(4);
  });

  it('has low bounded terrain patches, faint moss intrusion and a lighter touch model', () => {
    const desktop = chroniclesRoadsideShoulderGeometry();
    const touch = chroniclesRoadsideShoulderGeometry({ coarsePointer: true });
    const restored = chroniclesRoadsideShoulderGeometry();
    const p = desktop.getAttribute('position');
    expect(p.count).toBeGreaterThan(touch.getAttribute('position').count);
    expect(p.count).toBeLessThanOrEqual(100);
    expect(desktop.getAttribute('color').count).toBe(p.count);
    expect(p.count).toBeLessThanOrEqual(100);
    // Each existing blade/moss shape plus ONE additional dirt-edge tongue
    // fits in the same shared batch without lifting the mobile polygon cost.
    expect(touch.getAttribute('position').count).toBeLessThanOrEqual(50);
    expect(desktop.boundingBox.min.x).toBeGreaterThan(-1.85);
    expect(desktop.boundingBox.max.x).toBeLessThan(1.85);
    expect(desktop.boundingBox.min.z).toBeGreaterThan(-0.12);
    expect(desktop.boundingBox.min.z).toBeLessThan(-0.095);
    expect(desktop.boundingBox.max.z).toBeGreaterThan(0.55);
    expect(desktop.boundingBox.max.z).toBeLessThan(0.75);
    expect(desktop.boundingBox.min.y).toBeGreaterThanOrEqual(0);
    expect(desktop.boundingBox.max.y).toBeLessThan(0.25);
    expect([...restored.getAttribute('position').array]).toEqual([...p.array]);
    for (const coord of p.array) expect(Number.isFinite(coord)).toBe(true);
    [desktop, touch, restored].forEach(g => g.dispose());
  });

  it.each([true, false])('blends the verge into dirt without adding triangles (coarse=%s)', (coarsePointer) => {
    const geometry = chroniclesRoadsideShoulderGeometry({ coarsePointer });
    const colors = geometry.getAttribute('color');
    const count = coarsePointer ? 4 : 8;
    const at = index => [colors.getX(index), colors.getY(index), colors.getZ(index)];
    expect(colors.count).toBe(count * 12);
    expect(colors.itemSize).toBe(4);
    for (let i = 0; i < count; i += 1) {
      const start = i * 12;
      // Both ground triangles share exactly the same vertex colours.
      expect(at(start)).toEqual(at(start + 3));
      expect(at(start + 1)).toEqual(at(start + 5));
      expect(at(start)).toEqual(at(start + 2));
      expect(at(start + 1)).toEqual(at(start + 4));
      // Soil-to-grass and apron-to-tread gradients are real and bounded.
      expect(at(start)).not.toEqual(at(start + 1));
      expect(at(start + 6)).toEqual(at(start + 7));
      expect(at(start + 6)).not.toEqual(at(start + 8));
      // Preserve solid contact and fade only the flat polygon edges.
      expect(colors.getW(start)).toBeCloseTo(0.85);
      expect(colors.getW(start + 1)).toBe(0);
      expect(colors.getW(start + 2)).toBeCloseTo(0.85);
      expect(colors.getW(start + 3)).toBeCloseTo(0.85);
      expect(colors.getW(start + 4)).toBe(0);
      expect(colors.getW(start + 5)).toBe(0);
      expect(colors.getW(start + 6)).toBeCloseTo(0.78);
      expect(colors.getW(start + 7)).toBeCloseTo(0.78);
      expect(colors.getW(start + 8)).toBe(0);
      if (i % 2) expect(colors.getW(start + 11)).toBe(1);
    }
    for (const value of colors.array) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    geometry.dispose();
  });

  it('adds one visual-only batch to Banner Road, not settlements or other biomes', () => {
    const plan = { id: map.id, mapId: map.id, regionKind: 'wilderness', biome: map.biome,
      width: map.grid[0].length, height: map.grid.length,
      grid: map.grid, center, content: [], scenery: [] };
    const build = scenePlan => {
      const scene = new THREE.Scene();
      buildChroniclesCampaignExterior(scene, { scenePlan });
      return scene;
    };
    const main = build(plan);
    const edge = main.getObjectByName('chronicles-banner-road-shoulders');
    const road = main.getObjectByName('chronicles-campaign-road');
    expect(edge).toBeInstanceOf(THREE.InstancedMesh);
    expect(road).toBeInstanceOf(THREE.InstancedMesh);
    expect(road.count).toBe(roadCells.length);
    expect(main.children.filter(m => m.name === 'chronicles-banner-road-shoulders')).toHaveLength(1);
    const matrix = new THREE.Matrix4();
    const northSouth = roadCells.findIndex(c => c.x === center.x && c.y === center.y + 1);
    const eastWest = roadCells.findIndex(c => c.x === center.x + 1 && c.y === center.y);
    const crossing = roadCells.findIndex(c => c.x === center.x && c.y === center.y);
    for (const index of [northSouth, eastWest, crossing]) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
    road.getMatrixAt(northSouth, matrix);
    expect(matrix.elements[0] * road.geometry.parameters.width).toBeCloseTo(2.64, 4);
    road.getMatrixAt(eastWest, matrix);
    expect(matrix.elements[10] * road.geometry.parameters.depth).toBeCloseTo(2.64, 4);
    road.getMatrixAt(crossing, matrix);
    // Unlike the old town cobbles, joined compacted-earth tiles have no
    // 8cm mortar gap; the crossing remains a full 4m-wide walkable junction.
    expect(matrix.elements[0] * road.geometry.parameters.width).toBeCloseTo(4, 4);
    expect(matrix.elements[10] * road.geometry.parameters.depth).toBeCloseTo(4, 4);
    const other = build({ ...plan, mapId: 'terra-c4' });
    const originalRoad = other.getObjectByName('chronicles-campaign-road');
    originalRoad.getMatrixAt(northSouth, matrix);
    // Generic Terra dirt paths now share the readable narrow trail width,
    // but do NOT acquire the authored Banner Road grass/soil shoulder batch.
    expect(matrix.elements[0] * originalRoad.geometry.parameters.width)
      .toBeCloseTo(2.64, 4);
    expect(other.getObjectByName('chronicles-banner-road-shoulders')).toBeUndefined();
    expect(build({ ...plan, regionKind: 'settlement' })
      .getObjectByName('chronicles-banner-road-shoulders')).toBeUndefined();
  });
});
