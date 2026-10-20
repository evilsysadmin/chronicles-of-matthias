import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { chroniclesApplyArrival } from '../chronicles/chroniclesArrival.js';
import { chroniclesNpcDialogueForState } from '../chronicles/chroniclesNpcDialogue.js';
import { chroniclesContextualContentAction, createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesFirstAudienceCue, { chroniclesCanMeetAldric } from './ChroniclesFirstAudienceCue.jsx';

function atMayor() {
  return { ...chroniclesApplyArrival(createChroniclesState('swordhaven-first-book')), x: 11, y: 10 };
}

function makeProps(state = atMayor()) {
  const contextualAction = chroniclesContextualContentAction(state);
  const npc = chroniclesNpcDialogueForState(state, contextualAction);
  return { state, contextualAction, npc };
}

describe('Chronicles · first Aldric encounter', () => {
  it('only offers the actual authored conversation at the mayor doorstep', () => {
    const here = makeProps();
    expect(chroniclesCanMeetAldric(here.state, here.contextualAction, here.npc)).toBe(true);
    const html = renderToStaticMarkup(<ChroniclesFirstAudienceCue {...here} />);
    expect(html).toContain('data-chronicles-first-audience');
    expect(html).toContain('Entrar y hablar');
    expect(html).toContain('alcalde Aldric');
    expect(html).toContain('Matthias alisa la carta');
    expect(here.state.swordhavenMayorMet).not.toBe(true);
    expect(here.state.inventory?.['sewer-key']).toBeUndefined();
  });

  it('does not invite dialogue from the square or after the mayor has been met', () => {
    const start = makeProps(chroniclesApplyArrival(createChroniclesState('swordhaven-first-book')));
    expect(chroniclesCanMeetAldric(start.state, start.contextualAction, start.npc)).toBe(false);
    expect(renderToStaticMarkup(<ChroniclesFirstAudienceCue {...start} />)).toBe('');
    const seen = makeProps({ ...atMayor(), swordhavenMayorMet: true });
    expect(renderToStaticMarkup(<ChroniclesFirstAudienceCue {...seen} />)).toBe('');
    expect(renderToStaticMarkup(<ChroniclesFirstAudienceCue {...makeProps()} suspended />)).toBe('');
  });

  it('cannot appear for a different quest, map or while fighting', () => {
    const { state, contextualAction, npc } = makeProps();
    for (const changed of [
      { ...state, quests: {} },
      { ...state, mapId: 'swordhaven-square' },
      { ...state, phase: 'defeated' },
      { ...state, initiative: { cursor: 0 } },
    ]) {
      expect(chroniclesCanMeetAldric(changed, contextualAction, npc)).toBe(false);
    }
  });
});
