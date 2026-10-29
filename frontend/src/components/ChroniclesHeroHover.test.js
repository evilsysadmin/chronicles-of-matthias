import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const styles = readFileSync(new URL('./ChroniclesOfMatthias.css', import.meta.url), 'utf8');
const dockStyles = readFileSync(new URL('./ChroniclesCharacterInventoryRetro.css', import.meta.url), 'utf8');

describe('Chronicles hero hover stability', () => {
  it('does not move exploration hero portraits out from under the cursor', () => {
    const hover = styles.match(/\.chronicles-party-member:hover,\s*\.chronicles-party-member:focus-visible\s*\{([^}]+)\}/);
    expect(hover).not.toBeNull();
    expect(hover[1]).toMatch(/transform:\s*none\s*;/);
    const button = styles.match(/\.chronicles-party-member\s*\{([^}]+)\}/);
    expect(button).not.toBeNull();
    expect(button[1]).not.toMatch(/transition:[^;]*\btransform\b/);
    expect(hover[1]).toContain('border-color:');
  });

  it('offers paint-only highlight on the party dock while preserving focus', () => {
    expect(dockStyles).toContain('Hero selection must never chase the pointer');
    expect(dockStyles).toMatch(/\.chronicles-character-sheet__party-dock button:hover:not\(\[aria-pressed='true'\]\)\s*\{[^}]*transform:\s*none;/);
    expect(dockStyles).toMatch(/\.chronicles-character-sheet__party-dock button:focus-visible\s*\{[^}]*transform:\s*none;/);
    expect(dockStyles).toContain('prefers-reduced-motion: reduce');
  });
});
