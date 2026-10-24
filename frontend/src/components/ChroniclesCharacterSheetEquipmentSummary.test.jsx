import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

const render = (rules, folio = 'equipment', stateOverrides = {}, memberId = null) => {
  const state = { ...createChroniclesState('swordhaven-first-book', null, { rules }), ...stateOverrides };
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, progression: createChroniclesProgression(), member: state.party.find((hero) => hero.id === memberId) || state.party[0],
    mode: 'chronicles', initialFolio: folio, onClose: () => {},
  }));
};

describe('Chronicles character sheet combat summary', () => {
  it('labels first-person MM3 equipment A separately from ranged S and never sells numeric damage reduction', () => {
    const html = render('mm3');
    expect(html).toContain('Equipo A: daño');
    expect(html).toContain('El disparo S usa sus propios bonos');
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

  it('shows each hero only their carried stock and provides a transfer control', () => {
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
    expect(hildegard).toContain('Pasar objeto');
    expect(hildegard).toContain('Compañero que recibirá el objeto');
  });

  it('retains the distinct legacy damage reduction summary', () => {
    const html = render(null);
    expect(html).toContain('mitigación');
    expect(html).not.toContain('CA del equipo');
    expect(html).not.toContain('El disparo S usa sus propios bonos');
  });
});
