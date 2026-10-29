import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

describe('ChroniclesPartyVitals', () => {
  it('shows only the numerical resource fractions inside their bars once', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={8} maxHp={11} sp={3} maxSp={4} band="hurt"
    />);
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('>8/11</span>');
    expect(html).toContain('>3/4</span>');
    expect(html.match(/>8\/11<\/span>/g)).toHaveLength(1);
    expect(html.match(/>3\/4<\/span>/g)).toHaveLength(1);
    expect(html).toContain('data-member-sp="3"');
    expect(html).not.toMatch(/>P[HV] /);
    expect(html).toContain('--fill:0.7272727272727273');
    expect(html).toContain('--fill:0.75');
  });

  it('does not create fictitious PH for a non-caster, nor invalid fill', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={0} maxHp={0} sp={0} maxSp={0} band="critical"
    />);
    expect(html).toContain('>0/0</span>');
    expect(html).not.toContain('class="is-sp"');
    expect(html).toContain('--fill:0');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('clamps negative and overfilled bars without changing the displayed source values', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={-1} maxHp={10} sp={13} maxSp={10} band="critical"
    />);
    expect(html).toContain('>-1/10</span>');
    expect(html).toContain('>13/10</span>');
    expect(html).toContain('--fill:0');
    expect(html).toContain('--fill:1');
  });
});
