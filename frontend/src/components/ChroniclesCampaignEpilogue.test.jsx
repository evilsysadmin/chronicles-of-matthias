import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesCampaignEpilogue from './ChroniclesCampaignEpilogue.jsx';

const state = {
  lostKingEnding: 'broken',
  templeKnightsFreed: false,
  f1BeaconChoice: 'rescue',
  quests: {
    'lost-king': { id: 'lost-king', status: 'completed' },
    'tax-of-the-forgotten': { id: 'tax-of-the-forgotten', status: 'completed' },
  },
  party: [{ name: 'Matthias', hp: 4 }, { name: 'Rook', hp: 0 }],
};

describe('ChroniclesCampaignEpilogue', () => {
  it('offers to keep exploring or close the chronicle when the ending was just chosen', () => {
    const html = renderToStaticMarkup(<ChroniclesCampaignEpilogue state={state} onContinue={() => {}} onClose={() => {}} />);
    expect(html).toContain('Sin corona');
    expect(html).toContain('Seguir explorando Terra');
    expect(html).toContain('Cerrar la crónica');
    expect(html).toContain('Tesa abre la puerta a un hermano');
    expect(html).toContain('alguien los espera en el muelle');
    expect(html).toContain('Rook no llega a ver la luz del día');
  });

  it('offers a new chronicle once the run is closed', () => {
    const html = renderToStaticMarkup(<ChroniclesCampaignEpilogue state={state} closed onRestart={() => {}} />);
    expect(html).toContain('CRÓNICA CERRADA');
    expect(html).toContain('Empezar otra crónica');
    expect(html).not.toContain('Seguir explorando');
  });

  it('renders nothing without an ending', () => {
    expect(renderToStaticMarkup(<ChroniclesCampaignEpilogue state={{}} />)).toBe('');
  });
});
