import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { chroniclesHealthBand } from './ChroniclesCombatRoster.jsx';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

describe('MM3 party PV/PH display', () => {
  it('uses life and mana gauges rather than visible numeric overlays', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 8, maxHp: 11, sp: 4, maxSp: 4, band: chroniclesHealthBand(8, 11),
    }));
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('class="is-hp"');
    expect(html).toContain('class="is-sp"');
    expect(html).toContain('aria-label="PV 8/11 · PH 4/4"');
    expect(html).toContain('title="PH 4/4"');
    expect(html).not.toContain('>8/11<');
    expect(html).not.toContain('>4/4<');
    expect(html).toContain('data-member-sp="4"');
  });

  it('leaves the HP gauge in the same slot for heroes without magic', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 10, maxHp: 10, maxSp: 0, band: chroniclesHealthBand(10, 10),
    }));
    expect(html).toContain('data-band="healthy"');
    expect(html).toContain('aria-label="PV 10/10"');
    expect(html).not.toContain('is-sp');
  });

  it('reports critical injuries while maintaining the spell-point reading', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 0, maxHp: 11, sp: 2, maxSp: 5, band: chroniclesHealthBand(0, 11),
    }));
    expect(html).toContain('data-band="critical"');
    expect(html).toContain('aria-label="PV 0/11 · PH 2/5"');
    expect(html).toContain('title="PV 0/11"');
    expect(html).toContain('title="PH 2/5"');
    expect(html).toContain('aria-hidden="true"');
  });
});


describe('MM3 mobile portrait clearance', () => {
  it('keeps the face in its own row and the PV/PH gauges outside the artwork', () => {
    const css = readFileSync(new URL('./ChroniclesMM3Chrome.css', import.meta.url), 'utf8');
    const mobile = css.split('/* Mobile portrait tiles reserve separate rows')[1]
      ?.split('/* Action captions belong to the play HUD')[0] || '';

    expect(mobile).toContain('@media (max-width: 800px), (max-width: 1024px) and (max-height: 600px)');
    expect(mobile).toContain('grid-template-columns: repeat(4, 52px)');
    const tile = mobile.match(/\.chronicles \.chronicles-party \.chronicles-party-member\s*\{([^}]+)\}/)?.[1] || '';
    expect(tile).toContain('height: 84px');
    expect(tile).toContain('grid-template-rows: 40px 30px');
    expect(tile).toContain('row-gap: 2px');

    const portrait = mobile.match(/\.chronicles \.chronicles-party \.chronicles-party-member > \.chronicles-party-glyph\s*\{([^}]+)\}/)?.[1] || '';
    expect(portrait).toContain('grid-area: 1 / 1');
    expect(portrait).toContain('height: 40px');

    const gauges = mobile.match(/\.chronicles \.chronicles-party \.chronicles-party-member > \.chronicles-party-bars\s*\{([^}]+)\}/)?.[1] || '';
    expect(gauges).toContain('grid-area: 2 / 1');
    expect(gauges).toContain('position: static');
    expect(gauges).toContain('grid-template-rows: repeat(2, 14px)');
    expect(gauges).toContain('pointer-events: none');
    expect(mobile).toContain('min-height: 14px');
    expect(css).toContain('font: 700 12px/1 var(--mm3-hud-font)');
  });
});
