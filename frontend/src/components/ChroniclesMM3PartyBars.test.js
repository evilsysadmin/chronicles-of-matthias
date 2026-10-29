import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { chroniclesHealthBand } from './ChroniclesCombatRoster.jsx';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

describe('MM3 party PV/PH display', () => {
  it('shows one exact value INSIDE each real PV/PH bar, without a second readout', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={8} maxHp={11} sp={4} maxSp={4} band={chroniclesHealthBand(8, 11)}
    />);
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('class="is-hp"');
    expect(html).toContain('class="is-sp"');
    expect(html).toContain('PV 8/11');
    expect(html).toContain('PH 4/4');
    expect(html.match(/PV 8\/11/g)).toHaveLength(1);
    expect(html.match(/PH 4\/4/g)).toHaveLength(1);
    expect(html).toContain('data-member-sp="4"');
  });

  it('keeps the PV bar when the hero has no magical resource', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={10} maxHp={10} maxSp={0} band={chroniclesHealthBand(10, 10)}
    />);
    expect(html).toContain('data-band="healthy"');
    expect(html).toContain('PV 10/10');
    expect(html).not.toContain('is-sp');
    expect(html).not.toContain('PH ');
  });

  it('passes the critically wounded state to the same responsive vitals element', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={0} maxHp={11} sp={2} maxSp={5} band={chroniclesHealthBand(0, 11)}
    />);
    expect(html).toContain('data-band="critical"');
    expect(html).toContain('PV 0/11');
    expect(html).toContain('PH 2/5');
    expect(html).toContain('aria-hidden="true"');
  });
});
