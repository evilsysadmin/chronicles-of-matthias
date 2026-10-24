import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('Chronicles first-person view without a persistent centre dot', () => {
  it('does not overlay a static crosshair over exploration artwork', () => {
    const jsx = readFileSync(fileURLToPath(new URL('./ChroniclesOfMatthias.jsx', import.meta.url)), 'utf8');
    const css = readFileSync(fileURLToPath(new URL('./ChroniclesOfMatthias.css', import.meta.url)), 'utf8');
    expect(jsx).not.toContain('className="chronicles-crosshair"');
    expect(css).not.toContain('.chronicles-crosshair');
    // Gameplay and hit-feedback overlays are independent of decorative reticles.
    expect(jsx).toContain('<ChroniclesHitSplat');
    expect(jsx).toContain('data-chronicles-renderer="three"');
  });
});
