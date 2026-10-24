import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ChroniclesOfMatthias.jsx', import.meta.url)), 'utf8');
const menu = readFileSync(fileURLToPath(new URL('./ChroniclesAdventureMenu.jsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./ChroniclesAdventureMenuFolio.css', import.meta.url)), 'utf8');

describe('Chronicles adventure menu folio — visual-only refactor (#134)', () => {
  it('retains existing save, resume, journal, status and guarded exit actions', () => {
    expect(menu).toContain('data-chronicles-adventure-menu');
    expect(menu).toContain('chronicles-game-menu__folio-columns');
    expect(menu).toContain('chronicles-game-menu__folio-sound');
    expect(source).toContain("persistCheckpoint(stateRef.current, 'manual')");
    expect(source).toContain('saveAndExit()');
    expect(menu).toContain('onSaveExit');
    expect(source).toContain('setConfirmExitWithoutSaving(true)');
    expect(source).toContain('discardAndExit()');
    expect(menu).toContain('onDiscardExit');
    expect(menu).toContain('data-chronicles-menu-journal');
    expect(menu).toContain('data-chronicles-menu-quick-status');
    expect(menu).toContain('id="chronicles-audio-options"');
  });
  it('preserves the dark folio from the legacy inline important black-ink workaround', () => {
    // A source guard supplements the actual Chromium contrast gate in public staging.
    expect(source).toContain("node.closest('.chronicles-game-menu__panel--folio')");
    expect(styles).toContain('-webkit-text-fill-color: #f2e2c3 !important');
  });
  it('keeps mobile touch and scroll affordances without adding rules or persistence', () => {
    expect(styles).toContain('max-height: calc(100dvh - 16px');
    expect(styles).toContain('overflow-y: auto');
    expect(styles).toContain('@media (max-width: 620px)');
    expect(styles).toContain('@media (orientation: landscape)');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('.chronicles-audio-controls');
    expect(styles).toContain('expedition-study-desktop-v2.avif');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(styles).toContain('background: transparent;');
  });
});
