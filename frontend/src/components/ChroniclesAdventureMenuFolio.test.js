import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ChroniclesOfMatthias.jsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./ChroniclesAdventureMenuFolio.css', import.meta.url)), 'utf8');

describe('Chronicles adventure menu folio — visual-only refactor (#134)', () => {
  it('retains existing save, resume, journal, status and guarded exit actions', () => {
    expect(source).toContain('data-chronicles-adventure-menu');
    expect(source).toContain('chronicles-game-menu__folio-columns');
    expect(source).toContain('chronicles-game-menu__folio-sound');
    expect(source).toContain("persistCheckpoint(stateRef.current, 'manual')");
    expect(source).toContain('saveAndExit()');
    expect(source).toContain('setConfirmExitWithoutSaving(true)');
    expect(source).toContain('discardAndExit()');
    expect(source).toContain('data-chronicles-menu-journal');
    expect(source).toContain('data-chronicles-menu-quick-status');
    expect(source).toContain('id="chronicles-audio-options"');
  });
  it('keeps mobile touch and scroll affordances without adding rules or persistence', () => {
    expect(styles).toContain('max-height: calc(100dvh - 16px');
    expect(styles).toContain('overflow-y: auto');
    expect(styles).toContain('@media (max-width: 620px)');
    expect(styles).toContain('@media (orientation: landscape)');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('.chronicles-audio-controls');
  });
});
