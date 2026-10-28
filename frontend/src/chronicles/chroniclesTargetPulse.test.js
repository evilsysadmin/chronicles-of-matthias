import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const stylesheet = readFileSync(
  new URL('../components/ChroniclesOfMatthias.css', import.meta.url), 'utf8',
);

describe('Chronicles tracked-objective pulse budget', () => {
  it('pulses the objective briefly then returns to an idle static marker', () => {
    const rules = stylesheet.match(/animation:\s*chronicles-target-pulse[^;]+;/g) || [];
    expect(rules).toHaveLength(2); // world map and minimap/automap
    for (const rule of rules) {
      expect(rule).toMatch(/chronicles-target-pulse\s+1\.8s\s+ease-in-out\s+3;/);
      expect(rule).not.toContain('infinite');
    }
  });

  it('ends at full opacity, keeps static target visibility, and respects reduced motion', () => {
    expect(stylesheet).toMatch(/@keyframes chronicles-target-pulse\s*\{[\s\S]*?100%\s*\{\s*opacity:\s*1;/);
    expect(stylesheet).toMatch(/\.chronicles-worldmap__cell\.is-target\s*\{[\s\S]*?border-color:\s*#ffd36a;/);
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.chronicles-minimap__target[\s\S]*?animation:\s*none;/);
  });
});
