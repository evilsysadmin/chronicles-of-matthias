import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createChroniclesState, chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from '../chronicles/chroniclesNpcDialogue.js';
import ChroniclesAudience from './ChroniclesAudience.jsx';

function audienceAt(x, y, gold = 40) {
  const state = {
    ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    x, y, inventory: { 'crown-gold': { id: 'crown-gold', quantity: gold } },
  };
  return chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));
}

describe('Chronicles Ilse audience · service / dialogue visual separation', () => {
  it('keeps priced services in the left semantic panel, lore on the right', () => {
    const html = renderToStaticMarkup(<ChroniclesAudience
      dialogue={audienceAt(14, 6)} onAction={() => {}} onClose={() => {}} />);
    expect(html).toContain('chronicles-audience--temple');
    expect(html).toContain('data-chronicles-temple-services');
    expect(html).toContain('aria-label="Servicios del templo"');
    const services = html.split('data-chronicles-temple-services')[1].split('chronicles-audience__dialogue')[0];
    const speech = html.split('chronicles-audience__dialogue')[1];
    for (const id of ['heal', 'revive', 'purify', 'donate']) {
      expect(services).toContain('data-chronicles-dialogue-choice="temple-' + id + '"');
      expect(speech).not.toContain('data-chronicles-dialogue-choice="temple-' + id + '"');
    }
    expect(services).toContain('data-chronicles-temple-gold');
    expect(services).toContain('data-chronicles-temple-result');
    expect(speech).toContain('data-chronicles-dialogue-choice="wounded"');
    expect(speech).toContain('data-chronicles-dialogue-choice="quest"');
    expect(speech).toContain('data-chronicles-dialogue-choice="leave"');
    expect(speech).not.toContain('data-chronicles-temple-gold');
    expect(services).toContain('1.');
    expect(speech).toContain('5.');
    expect(html).toContain('disabled=""');
  });

  it('leaves mayor and watch-house conversation unchanged without a services panel', () => {
    for (const [x, y] of [[11, 10], [4, 6]]) {
      const html = renderToStaticMarkup(<ChroniclesAudience
        dialogue={audienceAt(x, y)} onAction={() => {}} onClose={() => {}} />);
      expect(html).not.toContain('chronicles-audience--temple');
      expect(html).not.toContain('data-chronicles-temple-services');
      expect(html).toContain('data-chronicles-dialogue-answer');
      expect(html).toContain('aria-label="Respuestas disponibles"');
      expect(html).toContain('data-chronicles-dialogue-choice="quest"');
    }
  });
});
