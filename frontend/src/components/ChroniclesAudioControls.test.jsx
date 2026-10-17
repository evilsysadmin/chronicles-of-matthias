import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';
import { setChroniclesFxVolume } from '../chronicles/chroniclesAudioSettings.js';
import { setAmbientVolume } from '../sound.js';

describe('ChroniclesAudioControls', () => {
  afterEach(() => {
    setAmbientVolume(1);
    setChroniclesFxVolume(1);
  });

  it('shows the stored music and SFX levels', () => {
    setAmbientVolume(0.4);
    setChroniclesFxVolume(0.65);
    const html = renderToStaticMarkup(<ChroniclesAudioControls idPrefix="t" />);
    expect(html).toContain('id="t-music-volume"');
    expect(html).toContain('id="t-sfx-volume"');
    expect(html).toContain('40 %');
    expect(html).toContain('65 %');
    expect(html).toContain('aria-label="Silenciar música"');
  });

  it('offers to turn a silenced channel back on', () => {
    setChroniclesFxVolume(0);
    const html = renderToStaticMarkup(<ChroniclesAudioControls idPrefix="t" hint="Pista" />);
    expect(html).toContain('aria-label="Activar efectos"');
    expect(html).toContain('<small>Pista</small>');
  });
});
