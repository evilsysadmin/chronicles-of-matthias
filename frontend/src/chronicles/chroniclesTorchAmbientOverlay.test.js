import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  chroniclesTorchGlowProjection,
  chroniclesTorchAmbientGlowBudget,
  chroniclesTorchGlowOccluded,
} from './chroniclesTorchAmbientOverlay.js';

function camera() {
  const view = new THREE.PerspectiveCamera(67, 2, 0.08, 70);
  view.position.set(0, 1.62, 0);
  view.lookAt(0, 1.62, -5);
  view.updateProjectionMatrix();
  view.updateMatrixWorld(true);
  return view;
}

describe('Static WebGL with CSS-composited torch ambience', () => {
  it('limits active glow layers to four on desktop and two on coarse pointers', () => {
    expect(chroniclesTorchAmbientGlowBudget()).toBe(4);
    expect(chroniclesTorchAmbientGlowBudget(false)).toBe(4);
    expect(chroniclesTorchAmbientGlowBudget(true)).toBe(2);
  });

  it('uses low-rate compositor flicker without backdrop blending or a WebGL loop', () => {
    const css = readFileSync(new URL('./chroniclesTorchAmbientOverlay.css', import.meta.url), 'utf8');
    expect(css).toMatch(/animation:\s*chronicles-torch-ambient-flicker\s+4\.2s\s+steps\(5,\s*end\)/);
    expect(css).not.toMatch(/mix-blend-mode\s*:/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/animation:\s*none/);
  });

  it('projects only torches within the view frustum', () => {
    const view = camera();
    const point = chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, -5), 800, 400);
    expect(point.x).toBeCloseTo(400);
    expect(point.y).toBeCloseTo(200);
    expect(point.size).toBeGreaterThan(10);
    expect(chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, 5), 800, 400)).toBeNull();
    expect(chroniclesTorchGlowProjection(view, new THREE.Vector3(100, 1.62, -5), 800, 400)).toBeNull();
  });

  it('makes distant glows smaller instead of exaggerating them', () => {
    const view = camera();
    const near = chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, -3), 800, 400);
    const far = chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, -15), 800, 400);
    expect(near.size).toBeGreaterThan(far.size);
    expect(chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, -40), 800, 400)).toBeNull();
  });

  it('rejects halos blocked by a wall but keeps torches on this side visible', () => {
    const view = camera();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.7));
    wall.position.set(0, 1.62, -2.5);
    wall.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    expect(chroniclesTorchGlowOccluded(raycaster, view, new THREE.Vector3(0, 1.62, -5), [wall])).toBe(true);
    expect(chroniclesTorchGlowOccluded(raycaster, view, new THREE.Vector3(0, 1.62, -1), [wall])).toBe(false);
    expect(chroniclesTorchGlowOccluded(raycaster, view, new THREE.Vector3(0, 1.62, -5), [])).toBe(false);
    wall.geometry.dispose();
    wall.material.dispose();
  });

  it('rejects invalid zero-size viewports without throwing', () => {
    const view = camera();
    expect(chroniclesTorchGlowProjection(view, new THREE.Vector3(0, 1.62, -5), 0, 400)).toBeNull();
  });
});
