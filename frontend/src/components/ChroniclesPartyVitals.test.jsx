import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

describe('ChroniclesPartyVitals', () => {
  it('integrates the real PV and PH fractions into their own bars once', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={8} maxHp={11} sp={3} maxSp={4} band="hurt"
    />);
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('PV 8/11');
    expect(html).toContain('PH 3/4');
    expect(html.match(/PV 8\/11/g)).toHaveLength(1);
    expect(html.match(/PH 3\/4/g)).toHaveLength(1);
    expect(html).toContain('data-member-sp="3"');
    expect(html).toContain('--fill:0.7272727272727273');
    expect(html).toContain('--fill:0.75');
  });

  it('does not create fictitious PH for a non-caster, nor invalid fill', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={0} maxHp={0} sp={0} maxSp={0} band="critical"
    />);
    expect(html).toContain('PV 0/0');
    expect(html).not.toContain('PH ');
    expect(html).toContain('--fill:0');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('clamps negative and overfilled bars without changing the displayed source values', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={-1} maxHp={10} sp={13} maxSp={10} band="critical"
    />);
    expect(html).toContain('PV -1/10');
    expect(html).toContain('PH 13/10');
    expect(html).toContain('--fill:0');
    expect(html).toContain('--fill:1');
  });
});
