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
  it('keeps empty A/S weapon cards readable and compact only on touch phones', () => {
    const compact = css.split('/* Empty A/S weapon cards waste two tall rows on phones')[1];
    expect(compact).toBeTruthy();
    expect(compact).toContain('@media (max-width: 520px) and (pointer: coarse)');
    expect(compact).toContain('.chronicles-character-sheet__weapon-card:not(:has(> button))');
    expect(compact).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(compact).toContain('grid-column: 1 / -1');
    expect(compact).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(sheet).toContain("worn?.name || 'Sin equipar'");
    expect(sheet).toContain('Daño ${stats.damage} · Acierto ${signed(stats.toHit)}');
    expect(sheet).not.toContain('· Alcance ${stats.reach}');
    expect(sheet).toContain("'Sin arma de proyectiles · no puede disparar'");
  });

  it('aligns populated mobile backpack glyphs without shrinking touch rows or changing desktop', () => {
    const glyphs = css.split('/* Mobile inventory glyphs are currently unframed inline symbols')[1];
    expect(glyphs).toBeTruthy();
    expect(glyphs).toContain('@media (max-width: 520px) and (pointer: coarse)');
    expect(glyphs).toContain('grid-template-columns: 26px minmax(0, 1fr) auto');
    expect(glyphs).toContain('min-height: 44px');
    expect(glyphs).toContain('.chronicles-character-sheet__inventory-glyph');
    expect(glyphs).toContain('width: 26px');
    expect(glyphs).toContain('height: 26px');
    expect(glyphs).toContain('text-overflow: ellipsis');
    expect(glyphs).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(sheet).toContain('aria-hidden="true"');
    expect(sheet).toContain('data-inventory-item={item.id}');
    expect(sheet).toContain("shield: '⬟'");
  });

  it('keeps mobile equipment comparisons complete but vertically tighter', () => {
    const compact = css.split('/* Compact the mobile comparison ledger')[1];
    expect(compact).toBeTruthy();
    expect(compact).toContain('@media (max-width: 520px) and (pointer: coarse)');
    expect(compact).toContain('.chronicles-character-sheet--mm3.chronicles-character-sheet--folio-v2');
    expect(compact).toContain('.chronicles-character-sheet__swap-preview > div');
    expect(compact).toContain('grid-template-columns: minmax(0, 1fr) auto 36px');
    expect(compact).toContain('padding: 3px 0');
    expect(compact).toContain('line-height: 1.3');
    expect(compact).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(sheet).toContain('chronicles-character-sheet__swap-preview');
  });


  it('keeps the primary mobile Equipar decision ahead of lengthy comparisons without hiding deltas', () => {
    const mobile = css.split('/* On narrow touch phones, place the primary Equipar decision')[1];
    expect(mobile).toBeTruthy();
    expect(mobile).toContain('@media (max-width: 520px) and (pointer: coarse)');
    expect(mobile).toContain('flex-direction: column');
    expect(mobile).toMatch(/__item-details > button\s*\{[^}]*order:\s*1;/);
    expect(mobile).toMatch(/__item-details > \.chronicles-character-sheet__swap-preview,[\s\S]*order:\s*2;/);
    expect(mobile).toMatch(/__item-details > \.chronicles-character-sheet__item-more\s*\{[^}]*order:\s*3;/);
    expect(mobile).toContain('min-height: 44px');
    expect(mobile).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(sheet).toContain("onEquipmentAction?.({ type: 'equip-item', itemId: selectedEquipment.id })");
    expect(sheet).toContain('disabled={!canChangeEquipment || !canEquipSelected}');
    expect(sheet).toContain('Si equipas este objeto');
    const disabled = mobile.match(/__item-details > button:disabled\s*\{([^}]*)\}/)?.[1];
    const enabled = mobile.match(/__item-details > button:not\(:disabled\)\s*\{([^}]*)\}/)?.[1];
    expect(disabled).toBeTruthy();
    expect(enabled).toBeTruthy();
    const ink = (rules, name) => rules.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})', 'i'))?.[1];
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    for (const rules of [disabled, enabled]) {
      const fg = luminance(ink(rules, 'color'));
      const bg = luminance(ink(rules, 'background'));
      expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(disabled).toContain('opacity: 1');
  });

});
