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

  it('labels guild and objective contextually on the local minimap', () => {
    const known = renderToStaticMarkup(
      <ChroniclesMinimap
        state={state}
        radius={7}
        visitedCells={['15:4']}
        target={target}
      />,
    );
    expect(known).toContain('data-chronicles-poi="guild"');
    expect(known).toContain('chronicles-minimap__legend');
    expect(known).toContain('class="is-guild"><b>G</b> gremio');
    expect(known).toContain('class="is-target"><b>★</b> objetivo');
    expect(known).toContain('★: rumbo al objetivo');

    const unknown = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7} visitedCells={[]} target={target} />,
    );
    expect(unknown).not.toContain('data-chronicles-poi="guild"');
    expect(unknown).not.toContain('class="is-guild"');
    expect(unknown).toContain('class="is-target"><b>★</b> objetivo');

    const noTarget = renderToStaticMarkup(
      <ChroniclesMinimap state={state} radius={7} visitedCells={['15:4']} />,
    );
    expect(noTarget).toContain('class="is-guild"><b>G</b> gremio');
    expect(noTarget).not.toContain('class="is-target"');
    expect(noTarget).not.toContain('★: rumbo al objetivo');
  });
});
