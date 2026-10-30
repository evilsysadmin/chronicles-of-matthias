import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesAutomap from './ChroniclesAutomap.jsx';
import { createChroniclesState } from '../chroniclesOfMatthias.js';

describe('Chronicles area automap fitting', () => {
  it('shows the entire Swordhaven grid at a fixed scale while hiding unknown topology', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const here = `${state.x}:${state.y}`;
    const render = (visitedCells) => renderToStaticMarkup(createElement(ChroniclesAutomap, {
      open: true, state, visitedCells, onClose: () => {},
    }));
    const initial = render([here]);
    const explored = render([here, '0:0', '18:22', '0:22', '18:0']);

    // Swordhaven is 19 columns × 23 rows; discovered bounds must not affect
    // this camera, even for a mostly unexplored or fully explored area.
    for (const html of [initial, explored]) {
      expect(html).toContain('viewBox="-0.5 -0.5 20 24"');
      expect(html).toContain('data-chronicles-map-fit="full-area"');
      expect(html).toContain('aria-label="Posición y orientación del grupo"');
    }
    expect(initial).toContain('data-chronicles-fog-cell="0:0"');
    expect(initial).not.toContain(`data-chronicles-fog-cell="${here}"`);
    expect(explored).not.toContain('data-chronicles-fog-cell="0:0"');
    expect((initial.match(/data-chronicles-fog-cell=/g) || []).length).toBe(19 * 23 - 1);
    expect(initial).toContain('chronicles-automap__cell is-unknown');
  });
});
