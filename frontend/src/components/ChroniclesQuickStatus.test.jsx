import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesQuickStatus from './ChroniclesQuickStatus.jsx';

describe('MM3 quick party status keeps level inside the character dossier', () => {
  it('shows tactical essentials without a persistent level column', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesQuickStatus, {
      open: true,
      rows: [{
        id: 'matthias', slot: 1, name: 'Matthias', classLabel: 'Caballero',
        hp: 11, maxHp: 11, sp: null, maxSp: null, armorClass: 3,
        weapon: 'Espada', condition: 'fresh', conditionLabel: 'Bien', level: 12,
      }],
      gold: 40,
      onClose: () => {},
      onOpenSheet: () => {},
    }));
    expect(html).toContain('Matthias');
    expect(html).toContain('11/11');
    expect(html).toContain('Arma');
    expect(html).toContain('Estado');
    expect(html).not.toContain('columnheader">Nv</span>');
    expect(html).not.toContain('role="cell">12</span>');
    expect(html).toContain('Abrir ficha');
  });
});
