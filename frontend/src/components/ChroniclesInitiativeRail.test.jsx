import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesInitiativeRail from './ChroniclesInitiativeRail.jsx';

describe('ChroniclesInitiativeRail', () => {
  it.each([[-1, 'first'], [99, 'last'], [1.8, 'last'], ['1', 'last'], [true, 'first'], ['bad', 'first']])(
    'uses the same active actor for status and visible order for restored cursor %s', (cursor, id) => {
      const order = [
        { id: 'first', kind: 'party', name: 'Primero', initiative: 9 },
        { id: 'last', kind: 'enemy', name: 'Último', initiative: 8 },
      ];
      const html = renderToStaticMarkup(<ChroniclesInitiativeRail initiative={{ cursor, round: 2, order }} />);
      expect(html).toContain(`data-active-actor="${id}"`);
      const name = id === 'first' ? 'Primero' : 'Último';
      expect(html).toContain(`Ronda 2. Turno de ${name}`);
      expect(html).toContain(`aria-current="step" aria-label="Ahora: ${name}`);
      expect(html.includes('is-round-start')).toBe(id === 'last');
    },
  );

  it('stays absent during exploration', () => {
    expect(renderToStaticMarkup(<ChroniclesInitiativeRail initiative={null} />)).toBe('');
  });

  it('rotates the visible order from the persisted cursor and announces the active actor', () => {
    const initiative = {
      die: '1d8',
      round: 3,
      cursor: 1,
      order: [
        { id: 'matthias', kind: 'party', name: 'Matthias', initiative: 9 },
        { id: 'wraith', kind: 'enemy', name: 'Espectro', initiative: 8 },
        { id: 'hildegard', kind: 'party', name: 'Hildegard', initiative: 6 },
      ],
    };

    const html = renderToStaticMarkup(<ChroniclesInitiativeRail initiative={initiative} />);
    expect(html).toContain('data-active-actor="wraith"');
    expect(html).toContain('Ronda 3. Turno de Espectro');
    expect(html.indexOf('Espectro')).toBeLessThan(html.indexOf('Hildegard'));
    expect(html.indexOf('Hildegard')).toBeLessThan(html.lastIndexOf('Matthias'));
    expect(html).toContain('TURNO ENEMIGO');
    // The visual micro-labels may be hidden, but turn order and initiative
    // remain fully accessible to keyboard/screen-reader players.
    expect(html).toContain('aria-label="Ahora: Espectro · iniciativa 8"');
    expect(html).toContain('aria-label="Después, posición 2: Hildegard · iniciativa 6"');
    expect(html).toContain('aria-label="Después, posición 3: Matthias · iniciativa 9 · ronda 4"');
    expect(html).toContain('is-round-start');
    expect(html).toContain('R+1 ');
    expect(html).toContain('title="Espectro"');
    expect(html).toContain('<span aria-hidden="true">AHORA</span>');
  });
});
