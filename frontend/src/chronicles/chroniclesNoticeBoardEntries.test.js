import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { chroniclesContextualContentAction, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesNoticeBoardEntries } from './chroniclesNoticeBoardEntries.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import ChroniclesNoticeBoard from '../components/ChroniclesNoticeBoard.jsx';

const atBoard = (state) => ({ ...state, x: 12, y: 10, direction: 0 });

describe('Swordhaven notice board — lasting offers', () => {
  it('remains a visible interaction with available, active and completed states', () => {
    const map = chroniclesMapById('swordhaven-first-book');
    const entry = map.interactables.find((item) => item.id === 'first-book-missing-board');
    expect(entry.visualType).toBe('notice-board');
    expect(entry.when).toEqual([]);
    const initial = atBoard(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }));
    expect(chroniclesContextualContentAction(initial)).toMatchObject({ id: entry.id, locked: false });
    expect(chroniclesNoticeBoardEntries(initial).posted[0]).toMatchObject({
      questId: 'banner-contract', status: 'available', canAccept: true,
    });
    const accepted = chroniclesReduce(initial, 'interact');
    expect(accepted.quests['banner-contract'].status).toBe('active');
    expect(chroniclesContextualContentAction(accepted)).toMatchObject({ id: entry.id, locked: true });
    expect(chroniclesNoticeBoardEntries(accepted).posted[0]).toMatchObject({
      status: 'active', canAccept: false,
    });
    const repeated = chroniclesReduce(accepted, 'interact');
    expect(repeated.quests).toEqual(accepted.quests);
    expect(repeated.journal).toEqual(accepted.journal);
    expect(repeated.claimedRewards).toEqual(accepted.claimedRewards);
    const completed = { ...accepted, quests: {
      ...accepted.quests,
      'banner-contract': { ...accepted.quests['banner-contract'], status: 'completed' },
    } };
    expect(chroniclesNoticeBoardEntries(completed).posted[0]).toMatchObject({
      status: 'completed', canAccept: false,
    });
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      chroniclesRunCheckpointPayload(accepted, 6),
    );
    expect(chroniclesNoticeBoardEntries(atBoard(restored)).posted[0].status).toBe('active');
  });

  it('renders the actual offer and other real quests, not a fabricated accepted quest', () => {
    const initial = atBoard(createChroniclesState('swordhaven-first-book'));
    const offers = chroniclesNoticeBoardEntries(initial);
    expect(offers.posted).toHaveLength(1);
    expect(offers.other).toHaveLength(0);
    const markup = renderToStaticMarkup(createElement(ChroniclesNoticeBoard, {
      state: initial, onAccept: () => {}, onClose: () => {},
    }));
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('El estandarte perdido');
    expect(markup).toContain('18 monedas de oro');
    expect(markup).toContain('data-chronicles-board-accept="first-book-missing-board"');

    const accepted = chroniclesReduce(initial, 'interact');
    const after = renderToStaticMarkup(createElement(ChroniclesNoticeBoard, {
      state: accepted, onAccept: () => {}, onClose: () => {},
    }));
    expect(after).toContain('data-chronicles-board-status="active"');
    expect(after).not.toContain('data-chronicles-board-accept');
  });
});
