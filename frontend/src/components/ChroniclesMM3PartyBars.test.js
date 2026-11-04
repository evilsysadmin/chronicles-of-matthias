import React from 'react';
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
