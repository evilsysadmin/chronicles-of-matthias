import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const render = (rules, folio = 'equipment', stateOverrides = {}, memberId = null, mode = 'chronicles') => {
  const state = { ...createChroniclesState('swordhaven-first-book', null, { rules }), ...stateOverrides };
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, progression: createChroniclesProgression(), member: state.party.find((hero) => hero.id === memberId) || state.party[0],
    mode, initialFolio: folio, onClose: () => {},
  }));
};

describe('Chronicles character sheet combat summary', () => {
  it('labels first-person MM3 equipment A separately from ranged S and never sells numeric damage reduction', () => {
    const html = render('mm3');
    expect(html).toContain('Equipo A: daño');
    expect(html).toContain('El disparo S usa sus propios bonos');
    expect(html).not.toMatch(/alcance/i);
    expect(html).toContain('CA del equipo');
    expect(html).toContain('dificulta impactos, no resta daño');
    expect(html).not.toMatch(/CA \+\d+ · reducción \d+/);
    expect(html).not.toContain('mitigación');
  });

  it('shows one consistent two-handed missile warning in the backpack and equipped ranged slot', () => {
    const html = render('mm3', 'equipment', {
      inventory: {
        'wooden-bow': { id: 'wooden-bow', quantity: 1, name: 'Arco corto de madera' },
      },
      equipment: { matthias: { weapon: 'brass-sword', missile: 'wooden-bow', shield: 'brass-shield' } },
    });
    expect(html).toContain('data-chronicles-equipment-handling');
    expect(html).toContain('data-chronicles-worn-handling');
    expect(html).toContain('Disparo a dos manos');
    expect(html).toContain('no aporta armadura ni acierto');
    expect(html).toContain('represalia inmediata');
    expect(html).toContain('class="chronicles-character-sheet__swap-preview"');
    expect(html).not.toMatch(/class="chronicles-character-sheet__swap-preview"[^>]*\sopen=/);
    expect(html).toMatch(/<summary>[\s\S]*?Daño [+-]?\d+ · Acierto [+-]?\d+/);
    expect(html).toContain('Ver comparación antes y después');

  });

  it('warns about a real two-handed weapon displacing a shield before expanding', () => {
    const html = render('mm3', 'equipment', {
      inventory: {
        'brass-staff': { id: 'brass-staff', quantity: 1, name: 'Bastón de latón' },
      },
      equipment: { matthias: { weapon: 'brass-sword', shield: 'brass-shield' } },
    });
    expect(html).toContain('class="chronicles-character-sheet__swap-preview"');
    const summary = html.match(/class="chronicles-character-sheet__swap-preview"[^>]*>\s*<summary>([\s\S]*?)<\/summary>/)?.[1] || '';
    expect(summary).toContain('Se guardará Escudo de latón en la mochila');
    expect(summary).toMatch(/CA -?\d+/);
  });

  it('keeps the shield benefit explanation for one-handed slings', () => {
    const html = render('mm3', 'equipment', {
      inventory: {
        'brass-sling': { id: 'brass-sling', quantity: 1, name: 'Honda de latón' },
      },
      equipment: { matthias: { missile: 'brass-sling', shield: 'brass-shield' } },
    });
    expect(html).toContain('Disparo a una mano');
    expect(html).toContain('mantiene las ventajas del escudo');
  });

  it('keeps individual backpacks and reserves 1–4 for navigation', () => {
    const inventory = {
      'brass-sword': { id: 'brass-sword', name: 'Espada de latón', quantity: 1 },
      'brass-shield': { id: 'brass-shield', name: 'Escudo de latón', quantity: 1 },
    };
    const ownership = { matthias: { 'brass-shield': 1 }, rook: { 'brass-sword': 1 } };
    const matthias = render('mm3', 'equipment', { inventory, bagOwners: ownership }, 'matthias');
    const hildegard = render('mm3', 'equipment', { inventory, bagOwners: ownership }, 'rook');
    expect(matthias).toContain('Mochila de Matthias');
    expect(matthias).toContain('data-inventory-item="brass-shield"');
    expect(matthias).not.toContain('data-inventory-item="brass-sword"');
    expect(hildegard).toContain('Mochila de Hildegard');
    expect(hildegard).toContain('data-inventory-item="brass-sword"');
    expect(hildegard).not.toContain('data-inventory-item="brass-shield"');
    expect(hildegard).toContain('Vista previa · selecciónalo para entregarlo');
    expect(hildegard).not.toContain('chronicles-character-sheet__inventory-hint');
    expect(hildegard).toContain('Seleccionar personaje de la compañía');
    expect(hildegard).not.toContain('Pasar objeto');
    expect(hildegard).not.toContain('Compañero que recibirá el objeto');
    expect(hildegard).not.toContain('Repartir botín');
  });

  it('keeps essential equipment actions visible while optional backpack controls and long attributes are collapsed', () => {
    const html = render('mm3', 'equipment', {
      inventory: { 'brass-sling': { id: 'brass-sling', quantity: 1, name: 'Honda de latón' } },
      bagOwners: { matthias: { 'brass-sling': 1 } },
    });
    expect(html).not.toContain('chronicles-character-sheet__backpack-tools');
    expect(html).not.toContain('Filtrar y buscar');
    expect(html).toMatch(/<details class="chronicles-character-sheet__item-more">\s*<summary>Descripción y atributos<\/summary>/);
    expect(html).toMatch(/Puede equiparlo|Clase incompatible/);
    expect(html).toContain('Equipar Honda de latón');
    expect(html).not.toMatch(/alcance/i);
    expect(html).toMatch(/Si equipas este objeto|Diferencia respecto al equipo actual/);
    expect(html).toContain('data-chronicles-equipment-handling');
    expect(html).not.toContain('Este personaje no lleva una reliquia vinculada.');
    const tactics = render(null, 'equipment', {}, null, 'tactics');
    expect(tactics).not.toContain('chronicles-character-sheet__backpack-advanced');
    expect(tactics).toContain('Mochila de expedición');
  });

  it('keeps filtering available for multiple owned item types', () => {
    const html = render('mm3', 'equipment', {
      inventory: {
        'brass-sling': { id: 'brass-sling', quantity: 1, name: 'Honda de latón' },
        'brass-shield': { id: 'brass-shield', quantity: 1, name: 'Escudo de latón' },
      },
      bagOwners: { matthias: { 'brass-sling': 1, 'brass-shield': 1 } },
    });
    expect(html).toMatch(/<details class="chronicles-character-sheet__backpack-tools">\s*<summary>/);
    expect(html).toContain('Filtrar y buscar');
    expect(html).toContain('chronicles-character-sheet__backpack-advanced');
    expect(html).toContain('Buscar en la mochila');
  });

  it('offers a compact closed worn-equipment summary before detailed stats and controls', () => {
    const html = render('mm3', 'equipment', {
      equipment: { matthias: { weapon: 'brass-sword', missile: 'wooden-bow' } },
    });
    expect(html).toContain('class="chronicles-character-sheet__equipped-disclosure"');
    expect(html).not.toMatch(/class="chronicles-character-sheet__equipped-disclosure"[^>]*\sopen=/);
    expect(html).toContain('class="chronicles-character-sheet__equipped-body"');
    expect(html).toContain('<span>Equipo puesto</span>');
    expect(html).toMatch(/<small title="[^"]*A: [^"]*">/);
    expect(html).toContain('Quitar');
    const tactics = render(null, 'equipment', {}, null, 'tactics');
    expect(tactics).not.toContain('chronicles-character-sheet__equipped-disclosure');
  });

  it('does not waste a row on missing MM3 relics, yet shows a real bound relic', () => {
    const withoutRelic = render('mm3', 'equipment', {}, 'matthias');
    expect(withoutRelic).not.toContain('chronicles-character-sheet__relic has-relic');
    expect(withoutRelic).not.toContain('>Reliquia vinculada<');
    expect(withoutRelic).not.toContain('>Ninguna<');
    const withRelic = render('mm3', 'equipment', { spectralLantern: true }, 'bishop');
    expect(withRelic).toContain('chronicles-character-sheet__relic has-relic');
    expect(withRelic).toContain('>Reliquia vinculada<');
    expect(withRelic).toContain('Farol espectral');
    expect(withRelic).toContain('Su luz sigue ligada al alfil');
    const tactics = render(null, 'equipment', {}, 'matthias', 'tactics');
    expect(tactics).toContain('>Reliquia vinculada<');
    expect(tactics).toContain('>Ninguna<');
  });

  it('retains the distinct legacy damage reduction summary', () => {
    const html = render(null);
    expect(html).toContain('mitigación');
    expect(html).not.toContain('CA del equipo');
    expect(html).not.toContain('El disparo S usa sus propios bonos');
  });
});