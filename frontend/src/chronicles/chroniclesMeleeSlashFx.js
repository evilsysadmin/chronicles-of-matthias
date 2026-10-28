import * as THREE from 'three';

// A tapered, off-axis blade trail in camera-local space. Unlike the previous
// circular reticle and straight bar, this is a single curved strike whose
// thin ends and brighter cutting edge read as motion rather than a target UI.
// Built once, then reused every swing; zero per-frame geometry allocations.
export function createChroniclesMeleeSlashRibbon(thickness = 1, segments = 28) {
  const safeThickness = Number.isFinite(thickness) && thickness > 0
    ? Math.min(thickness, 4) : 1;
  const steps = Math.max(8, Math.min(64, Math.trunc(segments) || 28));
  const positions = [];
  const triangles = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = Math.PI * t;
    const x = -0.56 + 1.12 * t;
    const y = -0.24 + 0.48 * t + 0.18 * Math.sin(angle);
    const dy = 0.48 + 0.18 * Math.PI * Math.cos(angle);
    const length = Math.hypot(1.12, dy);
    const taper = Math.pow(Math.max(0, Math.sin(angle)), 0.8);
    const halfWidth = (0.0015 + 0.058 * taper) * safeThickness;
    const nx = -dy / length * halfWidth;
    const ny = 1.12 / length * halfWidth;
    positions.push(x + nx, y + ny, 0, x - nx, y - ny, 0);
    if (i < steps) {
      const a = i * 2;
      triangles.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeBoundingSphere();
  return geometry;
}
