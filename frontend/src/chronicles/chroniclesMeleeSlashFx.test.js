import { describe, expect, it } from 'vitest';
import { createChroniclesMeleeSlashRibbon } from './chroniclesMeleeSlashFx.js';

function halfWidth(attribute, segment) {
  const a = segment * 2;
  return Math.hypot(
    attribute.getX(a) - attribute.getX(a + 1),
    attribute.getY(a) - attribute.getY(a + 1),
  ) / 2;
}

describe('MM3 hero melee visual: tapered moving blade arc', () => {
  it('creates a curved open ribbon rather than an annulus or straight reticle', () => {
    const geometry = createChroniclesMeleeSlashRibbon();
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBe(58);
    expect(geometry.index.count).toBe(28 * 6);
    const y = (step) => (positions.getY(step * 2) + positions.getY(step * 2 + 1)) / 2;
    const firstY = y(0);
    const lastY = y(28);
    expect(y(14)).toBeGreaterThan((firstY + lastY) / 2 + 0.1);
    expect(halfWidth(positions, 14)).toBeGreaterThan(halfWidth(positions, 0) * 10);
    expect(halfWidth(positions, 14)).toBeGreaterThan(halfWidth(positions, 28) * 10);
    expect(positions.getX(56)).toBeGreaterThan(positions.getX(0) + 0.9);
    geometry.dispose();
  });

  it('bounds supplied geometry parameters and keeps all vertices finite', () => {
    for (const thickness of [0, -5, Infinity, 0.5, 1.8, 8]) {
      const geometry = createChroniclesMeleeSlashRibbon(thickness, 10000);
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBe(130); // 64 capped segments, 2 vertices each.
      for (let index = 0; index < positions.count; index += 1) {
        expect(Number.isFinite(positions.getX(index))).toBe(true);
        expect(Number.isFinite(positions.getY(index))).toBe(true);
        expect(positions.getZ(index)).toBe(0);
      }
      expect(geometry.boundingSphere.radius).toBeGreaterThan(0);
      geometry.dispose();
    }
  });
});
