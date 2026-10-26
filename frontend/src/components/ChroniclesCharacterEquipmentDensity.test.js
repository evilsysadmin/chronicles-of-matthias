import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./ChroniclesCharacterEquipmentDensity.css', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
const mobileEmpty = css.split('/* Compact only genuinely empty mobile gear panels.')[1];

describe('MM3 empty equipment cards — touch-only presentation', () => {
  it('only condenses empty backpacks and unlinked relics on narrow touch screens', () => {
    expect(mobileEmpty).toBeTruthy();
    expect(mobileEmpty).toContain('@media (max-width: 520px) and (pointer: coarse)');
    expect(mobileEmpty).toContain('.chronicles-character-sheet--mm3.chronicles-character-sheet--folio-v2');
    expect(mobileEmpty).toContain('.chronicles-character-sheet__backpack:has(> small):not(:has(> details))');
    expect(mobileEmpty).toMatch(/\.chronicles-character-sheet__relic:not\(\.has-relic\)/);
    expect(mobileEmpty).toContain('min-height: 0');
    expect(mobileEmpty).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it('preserves the readable empty-state copy and existing equipment actions', () => {
    expect(sheet).toContain('Este personaje no lleva objetos en su mochila.');
    expect(sheet).toContain("relic?.name || 'Ninguna'");
    expect(sheet).toContain('chronicles-character-sheet__relic has-relic');
    expect(sheet).toContain('data-chronicles-equipment-folio');
    expect(sheet).toContain('Armas y armaduras equipadas');
  });
});
