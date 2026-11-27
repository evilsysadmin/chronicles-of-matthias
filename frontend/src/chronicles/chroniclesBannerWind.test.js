import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyChroniclesBannerWind } from './chroniclesBannerWind.js';
import { buildTerraScenery } from './chroniclesTerraScenery.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

describe('Banner Road bounded meadow wind', () => {
  it('updates only shader uniforms on render, pins roots and honors reduced motion', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(), 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    const matrices = [...mesh.instanceMatrix.array];
    let time = 1000;
    const reducedMotion = { matches: false };
    expect(applyChroniclesBannerWind(mesh, { now: () => time, reducedMotion })).toBe(true);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader };
    mesh.material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('smoothstep(0.025, 0.33, position.y)');
    expect(shader.vertexShader).toContain('tip * tip * chroniclesWindStrength');
    mesh.onBeforeRender();
    expect(shader.uniforms.chroniclesWindPhase.value).toBeCloseTo(1.7);
    expect(shader.uniforms.chroniclesWindStrength.value).toBe(1);
    time += 1000;
    mesh.onBeforeRender();
    expect(shader.uniforms.chroniclesWindPhase.value).toBeCloseTo(3.4);
    reducedMotion.matches = true;
    mesh.onBeforeRender();
    expect(shader.uniforms.chroniclesWindStrength.value).toBe(0);
    expect([...mesh.instanceMatrix.array]).toEqual(matrices);
    expect(mesh.material.customProgramCacheKey()).toContain('chronicles-banner-wind-v1');
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it.each([true, false])('affects only existing non-shadowing C3 vegetation batches (coarse=%s)', coarsePointer => {
    const map = chroniclesMapById('banner-road-first-book');
    const args = { mapId: map.id, biome: map.biome, grid: map.grid,
      center: { x: 10, y: 7 }, coarsePointer };
    const scene = buildTerraScenery(args);
    const other = buildTerraScenery({ ...args, mapId: 'terra-c4' });
    const tuft = scene.getObjectByName('chronicles-terra-tuft');
    expect(tuft.count).toBeGreaterThan(0);
    expect(tuft.material.customProgramCacheKey()).toContain('chronicles-banner-wind-v1');
    expect(other.getObjectByName(tuft.name).material.customProgramCacheKey())
      .not.toContain('chronicles-banner-wind-v1');
    for (const mesh of scene.children.filter(node => node.isInstancedMesh)) {
      if (mesh.material.customProgramCacheKey().includes('chronicles-banner-wind-v1')) {
        expect(['tuft', 'meadowSedge', 'forestHerb', 'flower']
          .map(part => 'chronicles-terra-' + part)).toContain(mesh.name);
        expect(mesh.castShadow).toBe(false);
      }
    }
  });
});
