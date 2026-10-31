import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression, grantChroniclesXp } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMemberSchool } from '../chronicles/chroniclesMagic.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const source = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
const levelCss = readFileSync(new URL('./ChroniclesCharacterLevelMM3.css', import.meta.url), 'utf8');
const archiveCss = readFileSync(new URL('./ChroniclesCharacterSheetArchive.css', import.meta.url), 'utf8');

function renderSheet({ memberId = 'matthias', rules = 'mm3', mode = 'chronicles', progression = createChroniclesProgression() } = {}) {
  const state = createChroniclesState('swordhaven-first-book', progression.characterBuild, { rules });
  return {
    state,
    html: renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
      state, member: state.party.find((hero) => hero.id === memberId),
      mode, progression, initialFolio: 'record',
      onSelectMember: () => {}, onClose: () => {},
    })),
  };
}

describe('MM3 individual character folio · restrained level and non-magic state', () => {
  it('gives Matthias a standalone visible level beside his class, only inside the folio', () => {
    const { html } = renderSheet();
    expect(html).toContain('id="chronicles-character-sheet-title">Matthias</h3>');
    expect(html).toMatch(/chronicles-character-sheet__class-label[^>]*>[^<]+<\/span>/);
    expect(html).toContain('data-chronicles-character-level');
    expect(html).toContain('aria-label="Nivel 1"');
    expect(html).toMatch(/Nivel <strong>1<\/strong>/);
    expect(html).toContain('XP para el siguiente nivel');
    expect(html).not.toContain('Ver hechizos de Hildegard');
    expect(levelCss).toContain('.chronicles-character-sheet--mm3');
    expect(levelCss).toContain('flex-wrap: wrap');
    expect(levelCss).toContain('font-variant-numeric: tabular-nums');
  });

  it('uses the real level after gaining XP, not a hard-coded Level 1', () => {
    const initial = createChroniclesProgression();
    const grown = grantChroniclesXp(initial, 'matthias', 100, 'level-folio-visible');
    expect(grown.awarded).toBeGreaterThan(0);
    expect(grown.levelUps.length).toBeGreaterThan(0);
    const currentLevel = grown.progression.heroes.matthias.level;
    const { html } = renderSheet({ progression: grown.progression });
    expect(html).toContain(`aria-label="Nivel ${currentLevel}"`);
    expect(html).toContain(`Nivel <strong>${currentLevel}</strong>`);
  });

  it('removes the unsolicited link to another hero but preserves spellcasters and the empty state', () => {
    const { state, html: knight } = renderSheet({ memberId: 'matthias' });
    expect(chroniclesMemberSchool(state.party.find((hero) => hero.id === 'matthias'))).toBeNull();
    expect(source).toContain('Este personaje no practica magia.');
    expect(source).not.toContain('Ver hechizos de ');
    expect(source).not.toContain('chronicles-character-sheet__spell-companion');
    expect(archiveCss).not.toContain('chronicles-character-sheet__spell-companion');
    expect( knight ).not.toContain('data-chronicles-spellbook="matthias"');
    const { html: caster } = renderSheet({ memberId: 'rook' });
    expect(chroniclesMemberSchool(state.party.find((hero) => hero.id === 'rook'))).toBeTruthy();
    expect(caster).toContain('data-chronicles-spellbook="rook"');
    expect(caster).toContain('LIBRO DE HECHIZOS');
  });

  it('leaves the Tactics dossier presentation and level untouched', () => {
    const { html } = renderSheet({ rules: null, mode: 'tactics' });
    expect(html).not.toContain('data-chronicles-character-level');
    expect(html).not.toContain('chronicles-character-sheet__identity-meta');
    expect(html).toContain('Nivel 1');
    expect(html).not.toContain('chronicles-character-sheet__no-spells');
  });
});
