import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesMinimap from './ChroniclesMinimap.jsx';

describe('ChroniclesMinimap', () => {
  it('renders a seven-by-seven local window centered on the party', () => {
    const state = createChroniclesState('crypt-eight-squares');
    const html = renderToStaticMarkup(
      <ChroniclesMinimap
        state={state}
        visitedCells={[`${state.x}:${state.y}`]}
      />,
    );

    expect(html).toContain('data-chronicles-minimap="visible"');
    expect(html).toContain('Minimapa local. Abrir automapa completo');
    expect(html).toContain(`viewBox="${state.x - 3} ${state.y - 3} 7 7"`);
    expect(html).toContain('data-chronicles-minimap-facing=');
  });

  it('uses the full map\'s F for forja and A for armaduras on discovered cells only', () => {
    const state = createChroniclesState('swordhaven-first-book');
    const notVisited = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} />,
    );
    expect(notVisited).not.toContain('data-chronicles-poi="smith"');
    expect(notVisited).not.toContain('data-chronicles-poi="armorer"');

    const forgeOnly = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={['7:4']} />,
    );
    expect(forgeOnly).toContain('data-chronicles-poi="smith"');
    expect(forgeOnly).toContain('data-chronicles-poi-id="first-book-weaponsmith"');
    expect(forgeOnly).toContain('Forja de Brunna');
    expect(forgeOnly).toMatch(/data-chronicles-poi="smith"[\\s\\S]*?<text[^>]*>F<\\/text>/);
    expect(forgeOnly).not.toContain('data-chronicles-poi="armorer"');

    const both = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={['7:4', '11:4']} />,
    );
    expect(both).toContain('data-chronicles-poi="armorer"');
    expect(both).toContain('data-chronicles-poi-id="first-book-armorer"');
    expect(both).toMatch(/data-chronicles-poi="armorer"[\\s\\S]*?<text[^>]*>A<\\/text>/);
    expect(both).not.toContain('data-chronicles-poi="guild"');
  });

  it('keeps the same discovered services and exit glyphs as the full map within the local window', () => {
    const state = createChroniclesState('swordhaven-first-book');
    // A larger test radius brings the guild and temple into view; the default
    // radius still only shows what is nearby.
    const visitedCells = ['7:4', '11:4', '15:4', '14:6', '13:6', '9:1', '11:10'];
    const html = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7} visitedCells={visitedCells} />,
    );
    for (const [category, glyph] of [
      ['smith', 'F'], ['armorer', 'A'], ['guild', 'G'], ['temple', 'T'],
      ['mayor', 'H'], ['exit', '↗'],
    ]) {
      expect(html, category).toContain(`data-chronicles-poi="${category}"`);
      expect(html, category).toMatch(
        new RegExp(`data-chronicles-poi="${category}"[\\\\s\\\\S]*?<text[^>]*>${glyph}</text>`),
      );
    }
    // Multiple authored interactions at a single temple tile must deduplicate.
    expect((html.match(/data-chronicles-poi-id="first-book-temple"/g) || []).length).toBe(1);
    // Still no unvisited secret locations, even within the viewport.
    expect(html).not.toContain('data-chronicles-poi-id="swordhaven-to-sewers"');
  });

  it('disappears while the full automap or a terminal overlay owns the scene', () => {
    const state = createChroniclesState('crypt-eight-squares');
    expect(renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} hidden />,
    )).toBe('');
  });

  it('marks the next step to the objective, or points to it from the rim', () => {
    const state = createChroniclesState('crypt-eight-squares');
    const near = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} target={{ x: state.x + 1, y: state.y }} />,
    );
    expect(near).toContain('data-chronicles-route-target="in-view"');
    const far = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} target={{ x: state.x + 9, y: state.y }} />,
    );
    expect(far).toContain('data-chronicles-route-target="edge"');
  });
});
