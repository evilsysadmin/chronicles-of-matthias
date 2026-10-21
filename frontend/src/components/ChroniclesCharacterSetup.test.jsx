import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCanonicalChroniclesCharacterBuild,
  createSeededChroniclesCharacterBuild,
} from '../chronicles/chroniclesCharacterBuilds.js';
import { CHRONICLES_PARTY } from '../chroniclesOfMatthias.js';
import { saveChroniclesCharacterDraft, clearChroniclesCharacterDraft } from '../chronicles/chroniclesCharacterDraft.js';
import ChroniclesCharacterSetup, { chroniclesClassRequirementProgress, chroniclesRollStatDelta } from './ChroniclesCharacterSetup.jsx';

function render(build) {
  return renderToStaticMarkup(
    <ChroniclesCharacterSetup
      currentBuild={build}
      onConfirm={() => {}}
      onExit={() => {}}
    />,
  );
}

describe('ChroniclesCharacterSetup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the canonical party as the obvious one-click path', () => {
    const html = render(createCanonicalChroniclesCharacterBuild(CHRONICLES_PARTY));

    expect(html).toContain('Elige tus personajes');
    expect(html).toContain('chronicles-character-setup__hero-grid');
    expect((html.match(/chronicles-character-setup__hero-plaque/g) || []).length).toBe(4);
    expect(html).toContain('matthias-chronicles-canonical-v3');
    expect(html).toContain('Empezar con este grupo');
    expect(html).toContain('Crear mis personajes');
    expect(html).toContain('¿Primera expedición?');
    expect(html).toContain('¿Qué aporta cada aventurero?');
    expect(html).toContain('data-testid="chronicles-party-role-guide"');
    expect(html).toContain('Matthias · Caballero');
    expect(html).toContain('Aziz · Clérigo');
    expect(html).not.toContain('COMPAÑÍA GUARDADA');
  });

  it('offers the full MM3-inspired identity, dice and class editor from a recovered draft', () => {
    localStorage.setItem('chess-study-auth-username', 'chronicles-editor-test');
    const build = createSeededChroniclesCharacterBuild('creator-ui', CHRONICLES_PARTY);
    expect(saveChroniclesCharacterDraft({ activeSlot: 'bishop', build }, CHRONICLES_PARTY)).toBe(true);
    try {
      const html = render(build);
      expect(html).toContain('data-chronicles-character-setup="editor"');
      expect(html).toContain('Forja tu compañía');
      expect(html).toContain('Identidad del aventurero');
      expect(html).toContain('Cambiar retrato · 10 opciones');
      expect(html).toContain('chronicles-character-setup__change-portrait');
      expect(html).toMatch(/aria-label="Nombre del héroe [1-4]: [^"]+"/);
      expect(html).not.toContain('aria-label="Nombre de bishop"');
      expect(html).toContain('data-editor-step="identity"');
      expect(html).toContain('role="tablist"');
      expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
      expect((html.match(/tabindex="-1"/g) || []).length).toBe(2);
      expect(html).toContain('aria-controls="chronicles-step-panel-stats"');
      expect(html).toContain('Siguiente: atributos');
      expect(html).not.toContain('Anterior: atributos');
      expect(html).not.toContain('Anterior: identidad');
      expect(html).toMatch(/aria-label="Héroe 1 de 4: [^"]+, [^"]+"/);
      expect((html.match(/aria-label="Héroe [1-4] de 4:/g) || []).length).toBe(4);
      expect(html).toContain('chronicles-character-setup__mobile-overview');
      expect(html).toContain('Raza');
      expect(html).toContain('Semiorco');
      expect(html).toContain('Alineamiento');
      expect(html).toContain('El retrato elegido se guarda con el héroe.');
      expect(html).toContain('Tirar dados');
      expect((html.match(/data-class-id=/g) || []).length).toBe(10);
      expect(html).toMatch(/[0-9]+ de 10 profesiones disponibles para tus atributos\./);
      expect(html).toContain('Vuelve a tirar atributos para optar a esta clase.');
      expect(html).toMatch(/<em>Te falta [^<]+ · Vuelve a tirar atributos<\/em>/);
      expect(html).toContain('aria-disabled="true"');
      expect(html).toMatch(/title="[^"]+tienes [A-Z]{3} \d+\/\d+[^"]+"/);
      expect(html).toContain('Hechizos');
      expect(html).toContain('Confirmar compañía');
    } finally {
      clearChroniclesCharacterDraft();
      localStorage.removeItem('chess-study-auth-username');
    }
  });

  it('offers a previous step when recovering the attributes editor', () => {
    localStorage.setItem('chess-study-auth-username', 'chronicles-editor-back-test');
    const build = createSeededChroniclesCharacterBuild('back-navigation', CHRONICLES_PARTY);
    expect(saveChroniclesCharacterDraft({ activeSlot: 'bishop', editorStep: 'stats', build }, CHRONICLES_PARTY)).toBe(true);
    try {
      const html = render(build);
      expect(html).toContain('data-editor-step="stats"');
      expect(html).toContain('Anterior: identidad');
      expect(html).toContain('Siguiente: clase');
    } finally {
      clearChroniclesCharacterDraft();
      localStorage.removeItem('chess-study-auth-username');
    }
  });

  it('compares actual rerolled attributes without inventing improvements', () => {
    expect(chroniclesRollStatDelta({ might: 10 }, { might: 16 }, 'might')).toBe(6);
    expect(chroniclesRollStatDelta({ might: 17 }, { might: 9 }, 'might')).toBe(-8);
    expect(chroniclesRollStatDelta({ might: 12 }, { might: 12 }, 'might')).toBe(0);
    expect(chroniclesRollStatDelta(null, { might: 12 }, 'might')).toBeNull();
  });

  it('shows class shortfalls as current and required stats', () => {
    expect(chroniclesClassRequirementProgress([
      { stat: 'might', have: 12, need: 15 },
      { stat: 'endurance', have: 10, need: 13 },
    ])).toBe('FUE 12/15 · RES 10/13');
  });

  it('surfaces a persisted custom party without hiding the canonical fallback', () => {
    const html = render(createSeededChroniclesCharacterBuild('vault-7', CHRONICLES_PARTY));

    expect(html).toContain('COMPAÑÍA GUARDADA');
    expect(html).toContain('Continuar con mi compañía');
    expect(html).toContain('Tu compañía está lista.');
    expect(html).toContain('data-testid="chronicles-party-role-guide"');
    expect(html).toContain('Editar personajes');
    expect(html).toContain('Volver al grupo canónico');
  });
});
