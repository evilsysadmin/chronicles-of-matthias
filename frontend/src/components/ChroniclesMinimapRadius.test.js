import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesMapCoordinatesLabel } from '../chronicles/chroniclesAutomap.js';
import { chroniclesRegionHudLocation } from '../chronicles/chroniclesRegionHud.js';
import { describe, expect, it } from 'vitest';
import ChroniclesMinimap, { chroniclesMinimapRadiusX } from './ChroniclesMinimap.jsx';

describe('Chronicles minimap width', () => {
  it('fills a wide frame with more columns and keeps square frames square', () => {
    expect(chroniclesMinimapRadiusX(3, 1)).toBe(3);
    expect(chroniclesMinimapRadiusX(3, 0.8)).toBe(3);
    // 7 rows in a 2.4:1 frame → 17 columns (radius 8).
    expect(chroniclesMinimapRadiusX(3, 2.4)).toBe(8);
    expect(chroniclesMinimapRadiusX(3, Number.NaN)).toBe(3);
  });
});

describe('Chronicles minimap position caption', () => {
  it('renders real map coordinates beneath the map within the same accessible map button', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const map = chroniclesMapForState(state);
    const position = chroniclesMapCoordinatesLabel(map, state);
    const html = renderToStaticMarkup(createElement(ChroniclesMinimap, {
      state, visitedCells: [], onExpand: () => {},
    }));
    expect(position).toBeTruthy();
    expect(html).toContain('data-chronicles-minimap="visible"');
    expect(html).toContain('data-chronicles-coordinates');
    expect(html).toContain(position);
    expect(html).toContain('data-chronicles-location');
    expect(html).toContain('class="chronicles-minimap__location-prefix">UBICACIÓN · </span>SWORDHAVEN');
    expect(html).toContain('Ubicación: SWORDHAVEN. Coordenadas: ' + position);
    expect(chroniclesRegionHudLocation(map).kind).toBe('PUEBLO');
    expect(html).not.toContain('PUEBLO');
    expect(html).not.toContain('RUMBO');
  });

  it('does not display the map or stale coordinates when the map is hidden', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const html = renderToStaticMarkup(createElement(ChroniclesMinimap, {
      state, visitedCells: [], hidden: true, onExpand: () => {},
    }));
    expect(html).toBe('');
    expect(html).not.toContain('data-chronicles-location');
  });
});
