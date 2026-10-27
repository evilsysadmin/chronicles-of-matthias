import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chrome = readFileSync(new URL('./ChroniclesMM3Chrome.css', import.meta.url), 'utf8');
const party = readFileSync(new URL('./ChroniclesOfMatthias.jsx', import.meta.url), 'utf8');
const desktop = chrome.split('/* ─── Isles of Terra details')[1]
  ?.split('/* Tall screens keep')[0] || '';

describe('MM3 party PV bar alignment', () => {
  it('reserves both desktop bar rows at the same pixel height for every hero', () => {
    expect(desktop).toContain('@media (min-width: 1025px), (min-width: 801px) and (min-height: 601px)');
    const bars = desktop.match(/\.chronicles \.chronicles-party-member \.chronicles-party-bars\s*\{([^}]+)\}/)?.[1] || '';
    expect(bars).toContain('grid-area: bars;');
    expect(bars).toContain('align-self: end;');
    expect(bars).toContain('grid-template-rows: repeat(2, 9px);');
    expect(desktop).toContain('.chronicles .chronicles-party-bars i { height: 9px; }');
  });

  it('keeps the portrait HUD focused on name, level, PV and PH without front/rear jargon', () => {
    const portraitStrip = party.split('<aside className="chronicles-party"')[1]
      ?.split('<main className="chronicles-stage-wrap">')[0] || '';
    expect(portraitStrip).toContain('{index + 1}. {member.name}');
    expect(portraitStrip).toContain('<small>Nv {chroniclesHeroProgress(progression, member.id).level}</small>');
    expect(portraitStrip).toContain('{member.hp}/{member.maxHp}');
    expect(portraitStrip).not.toMatch(/FRENTE|RETAGUARDIA|member\\.row/);
  });

  it('still renders PH only for actual spellcasters, not an invented resource bar', () => {
    expect(party).toContain('<i className="is-hp"');
    expect(party).toMatch(/chroniclesMemberMaxSp\(state, member\) > 0 && \(\s*<i className="is-sp"/);
    expect(chrome).toContain('.chronicles .chronicles-party-bars .is-hp { --bar: #3cc63f; }');
    expect(chrome).toContain('.chronicles .chronicles-party-bars .is-sp { --bar: #4f8df0; }');
  });
});
