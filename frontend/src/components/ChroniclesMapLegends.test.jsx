import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesAutomap from './ChroniclesAutomap.jsx';
import ChroniclesMinimap from './ChroniclesMinimap.jsx';

describe('MM3 map symbol legends', () => {
  const state = createChroniclesState('swordhaven-first-book');
  const target = { x: state.x + 1, y: state.y };

  it('distinguishes G gremio from the ★ route in the full map', () => {
    const html = renderToStaticMarkup(
      <ChroniclesAutomap
        open
        state={state}
        visitedCells={['15:4']}
        onClose={() => {}}
        target={target}
      />,
    );

    expect(html).toContain('data-chronicles-poi="guild"');
    expect(html).toContain('chronicles-automap__legend-guild');
    expect(html).toContain('>G</i> gremio');
    expect(html).toContain('★</i> rumbo al objetivo');
    expect(html).toContain('Solo lugares descubiertos');
  });

  it('uses only the real next exit clue for the objective star, never an invented guild destination', () => {
    const label = 'Camino de los estandartes · por el norte';
    const full = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} visitedCells={[]}
        onClose={() => {}} target={target} routeLabel={label} />,
    );
    expect(full).toContain('Siguiente salida hacia el objetivo: Camino de los estandartes');
    expect(full).toContain('salida: <b class="chronicles-automap__route-label"');
    expect(full).toContain('Camino de los estandartes · por el norte');

    const small = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} target={target} routeLabel={label} />,
    );
    expect(small).toContain('siguiente salida: Camino de los estandartes');
    expect(small).not.toContain('title="Siguiente salida:');
    expect(small).not.toContain('chronicles-minimap__legend');

    // Without an active route, stale strings must not suggest a destination.
    const none = renderToStaticMarkup(
      <ChroniclesMinimap state={state} visitedCells={[]} routeLabel={label} />,
    );
    expect(none).not.toContain('Camino de los estandartes');
    expect(none).not.toContain('★: rumbo al objetivo');
  });

  it('preserves the discovered guild G when ★ targets the same map cell', () => {
    const sameTile = { x: 15, y: 4 };
    const full = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} onClose={() => {}}
        visitedCells={['15:4']} target={sameTile} />,
    );
    expect(full).toContain('data-chronicles-poi="guild"');
    expect(full).toContain('>G</text>');
    expect(full).toContain('data-chronicles-route-overlap="poi"');
    expect(full).toContain('r="0.21"');

    const small = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7}
        visitedCells={['15:4']} target={sameTile} />,
    );
    expect(small).toContain('data-chronicles-poi="guild"');
    expect(small).toContain('>G</text>');
    expect(small).toContain('data-chronicles-route-overlap="poi"');
    expect(small).toContain('r="0.21"');

    // Unknown guilds must not trigger the overlapping POI presentation.
    const unknown = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7} visitedCells={[]} target={sameTile} />,
    );
    expect(unknown).not.toContain('data-chronicles-poi="guild"');
    expect(unknown).not.toContain('data-chronicles-route-overlap="poi"');
    expect(unknown).toContain('r="0.42"');

    // Standard route markers retain the larger central star when no POI overlaps.
    const emptyTile = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} onClose={() => {}}
        visitedCells={[]} target={{ x: state.x + 1, y: state.y }} />,
    );
    expect(emptyTile).not.toContain('data-chronicles-route-overlap="poi"');
    expect(emptyTile).toContain('r="0.46"');
  });

  it('keeps the party arrow visible when the next route tile is the current tile', () => {
    const partyState = createChroniclesState('crypt-eight-squares');
    const here = { x: partyState.x, y: partyState.y };
    const full = renderToStaticMarkup(
      <ChroniclesAutomap open state={partyState} onClose={() => {}}
        visitedCells={[]} target={here} />,
    );
    expect(full).toContain('data-chronicles-route-overlap="party"');
    expect(full).toContain('class="chronicles-automap__target is-corner-badge"');
    expect(full).toContain('class="chronicles-automap__party-marker"');
    expect(full).toContain('r="0.21"');

    const mini = renderToStaticMarkup(
      <ChroniclesMinimap state={partyState} visitedCells={[]} target={here} />,
    );
    expect(mini).toContain('data-chronicles-route-overlap="party"');
    expect(mini).toContain('class="chronicles-minimap__target is-corner-badge"');
    expect(mini).toContain('class="chronicles-minimap__party"');
    expect(mini).toContain('r="0.21"');

    const distant = renderToStaticMarkup(
      <ChroniclesMinimap state={partyState} visitedCells={[]}
        target={{ x: partyState.x + 12, y: partyState.y }} />,
    );
    expect(distant).toContain('data-chronicles-route-target="edge"');
    expect(distant).not.toContain('data-chronicles-route-overlap=');
  });

  it('shows a directional edge marker when the full automap cannot fit the next exit', () => {
    // Swordhaven's authored northern exit lies beyond a newly explored map.
    const far = { x: 9, y: 1 };
    const html = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} onClose={() => {}}
        visitedCells={[]} target={far} routeLabel="Camino de los estandartes · por el norte" />,
    );
    expect(html).toContain('data-chronicles-route-target="edge"');
    expect(html).toContain('class="chronicles-automap__target is-offscreen"');
    expect(html).toContain('Siguiente salida fuera de la vista: Camino de los estandartes');
    expect(html).not.toContain('data-chronicles-route-target="in-view"');
    expect(html).not.toContain('r="0.46"');
    // The map is NOT extended with invented known tiles or the unseen exit.
    expect(html).toContain('viewBox="');
    expect(html).not.toContain('data-chronicles-poi-id="to-first-book-banner-road"');

    const near = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} onClose={() => {}}
        visitedCells={[]} target={{ x: state.x + 1, y: state.y }} />,
    );
    expect(near).toContain('data-chronicles-route-target="in-view"');
    expect(near).not.toContain('data-chronicles-route-target="edge"');

    const noRoute = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} onClose={() => {}}
        visitedCells={[]} />,
    );
    expect(noRoute).not.toContain('data-chronicles-route-target=');
  });

  it('reserves every minimap tile for the map while the full map retains its legend', () => {
    const known = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7} visitedCells={['15:4']}
        target={target} routeLabel="Camino de los estandartes" />,
    );
    expect(known).toContain('data-chronicles-poi="guild"');
    expect(known).toContain('data-chronicles-route-target="in-view"');
    expect(known).not.toContain('chronicles-minimap__legend');
    expect(known).not.toContain('title="Siguiente salida:');
    expect(known).toContain('★: rumbo al objetivo');
    expect(known).toContain('siguiente salida: Camino de los estandartes');
    const full = renderToStaticMarkup(
      <ChroniclesAutomap open state={state} visitedCells={['15:4']}
        target={target} onClose={() => {}} />,
    );
    expect(full).toContain('chronicles-automap__legend-guild');
    expect(full).toContain('★</i> rumbo al objetivo');
  });
});
