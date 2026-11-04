import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesPartyVitals from './ChroniclesPartyVitals.jsx';

const gaugeCSS = readFileSync(new URL('./ChroniclesPartyVitals.css', import.meta.url), 'utf8');

describe('ChroniclesPartyVitals', () => {
  it('keeps the recessed PV/PH gauges but omits white diamond ornaments', () => {
    expect(gaugeCSS).toContain('.chronicles-vital-fill');
    expect(gaugeCSS).toContain('grid-template-rows: repeat(2, 22px)');
    expect(gaugeCSS).toContain('linear-gradient(180deg, var(--vital-shine)');
    expect(gaugeCSS).not.toContain('.chronicles-party-bars i::before');
    expect(gaugeCSS).not.toContain('.chronicles-party-bars i::after');
  });
  it('renders gemstone fills with exact PV/PH available through accessible labels and hover', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={8} maxHp={11} sp={3} maxSp={4} band="hurt"
    />);
    expect(html).toContain('data-band="hurt"');
    expect(html).toContain('class="chronicles-vital-fill"');
    expect(html.match(/class="chronicles-vital-fill"/g)).toHaveLength(2);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="PV 8/11 · PH 3/4"');
    expect(html).toContain('title="PV 8/11"');
    expect(html).toContain('title="PH 3/4"');
    expect(html).not.toContain('>8/11<');
    expect(html).not.toContain('>3/4<');
    expect(html).toContain('data-member-sp="3"');
    expect(html).toContain('--fill:0.7272727272727273');
    expect(html).toContain('--fill:0.75');
  });

  it('retains the top row without fabricating magic points for a non-caster', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={0} maxHp={0} sp={0} maxSp={0} band="critical"
    />);
    expect(html).toContain('aria-label="PV 0/0"');
    expect(html).toContain('title="PV 0/0"');
    expect(html).not.toContain('class="is-sp"');
    expect(html).toContain('--fill:0');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('clamps only the graphic while preserving the real out-of-range values', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyVitals
      hp={-1} maxHp={10} sp={13} maxSp={10} band="critical"
    />);
    expect(html).toContain('aria-label="PV -1/10 · PH 13/10"');
    expect(html).toContain('title="PV -1/10"');
    expect(html).toContain('title="PH 13/10"');
    expect(html).toContain('--fill:0');
    expect(html).toContain('--fill:1');
  });
});
