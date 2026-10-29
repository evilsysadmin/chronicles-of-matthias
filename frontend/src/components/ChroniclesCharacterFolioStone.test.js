import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Purely visual migration: keep the same sheet and gameplay, change materials.
const css = readFileSync(new URL('./ChroniclesCharacterFolioStone.css', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');

describe('MM3 character folio shared stone palette', () => {
  it('loads after the legacy chapter skins without affecting Tactics or equipment', () => {
    expect(sheet).toContain("import './ChroniclesCharacterFolioStone.css';");
    expect(sheet.indexOf("ChroniclesCharacterFolioStone.css"))
      .toBeGreaterThan(sheet.indexOf("ChroniclesCharacterInventoryClassic.css"));
    expect(css).toContain(':has([data-chronicles-chapter]:not([data-chronicles-chapter="equipment"]))');
    expect(css).toContain('--folio-stone:#303b3e;');
    expect(css).toContain('--folio-paper:#d9ceb5;');
  });

  it('styles record attributes and gear, the spellbook, and training choices', () => {
    for (const selector of [
      '[data-chronicles-chapter=\'record\']',
      '.chronicles-character-sheet__section--core-stats',
      '.chronicles-character-sheet__worn li',
      '.chronicles-sheet-grimoire__list button.is-selected',
      '.chronicles-sheet-grimoire__detail',
      '[data-chronicles-training]',
      '[data-chronicles-training] button:disabled',
    ]) expect(css).toContain(selector);
    expect(css).not.toContain('#bf7d49');
    expect(css).not.toContain('#b97b46');
  });
});
