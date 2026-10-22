import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesFeedbackMailbox from './ChroniclesFeedbackMailbox.jsx';

describe('Chronicles feedback draft continuity', () => {
  it('renders the preserved message AND non-default category after returning from Back', () => {
    const html = renderToStaticMarkup(
      <ChroniclesFeedbackMailbox
        onBack={() => {}}
        draft="Una mejora del mapa"
        onDraftChange={() => {}}
        draftCategory="idea"
        onCategoryChange={() => {}}
      />,
    );
    expect(html).toContain('Una mejora del mapa');
    expect(html).toMatch(/<option[^>]*value="idea"[^>]*selected[^>]*>Proponer una idea<\/option>/);
    expect(html).not.toMatch(/<option[^>]*value="bug"[^>]*selected/);
  });

  it('keeps the default bug category when mounted independently', () => {
    const html = renderToStaticMarkup(<ChroniclesFeedbackMailbox onBack={() => {}} />);
    expect(html).toMatch(/<option[^>]*value="bug"[^>]*selected[^>]*>Informar de un bug<\/option>/);
  });
});
