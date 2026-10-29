import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { chroniclesHealthBand } from './ChroniclesCombatRoster.jsx';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

describe('MM3 party PV/PH display', () => {
  it('shows only numeric values inside each real resource bar, without redundant labels', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 8, maxHp: 11, sp: 4, maxSp: 4, band: chroniclesHealthBand(8, 11),
    }));
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('class="is-hp"');
    expect(html).toContain('class="is-sp"');
    expect(html).toContain('>8/11</span>');
    expect(html).toContain('>4/4</span>');
    expect(html.match(/>8\/11<\/span>/g)).toHaveLength(1);
    expect(html.match(/>4\/4<\/span>/g)).toHaveLength(1);
    expect(html).toContain('data-member-sp="4"');
    expect(html).not.toMatch(/>P[HV] /);
  });

  it('keeps the PV bar when the hero has no magical resource', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 10, maxHp: 10, maxSp: 0, band: chroniclesHealthBand(10, 10),
    }));
    expect(html).toContain('data-band="healthy"');
    expect(html).toContain('>10/10</span>');
    expect(html).not.toContain('is-sp');
    expect(html).not.toContain('class="is-sp"');
  });

  it('passes the critically wounded state to the same responsive vitals element', () => {
    const html = renderToStaticMarkup(React.createElement(ChroniclesPartyVitals, {
      hp: 0, maxHp: 11, sp: 2, maxSp: 5, band: chroniclesHealthBand(0, 11),
    }));
    expect(html).toContain('data-band="critical"');
    expect(html).toContain('>0/11</span>');
    expect(html).toContain('>2/5</span>');
    expect(html).toContain('aria-hidden="true"');
  });
});
