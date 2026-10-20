import { describe, expect, it } from 'vitest';
import { chroniclesQuestRecordedEvents } from './chroniclesQuestRecordedEvents.js';
import questEventLinks from './campaign/quest-event-links.json';
import swordhaven from './maps/swordhaven-first-book.json';
import bannerRoad from './maps/banner-road-first-book.json';
import rookwood from './maps/rookwood-first-book.json';

const recorded = (id, title = id) => ({ id, title, body: 'Este acontecimiento quedó registrado durante el viaje.' });

function authoredReceiptIds(content) {
  const result = new Set();
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.journal?.id) result.add(value.journal.id);
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(content);
  return result;
}

describe('Chronicles quest history is made only from witnessed receipts', () => {
  it('includes only existing journal events, preserving the actual saved order', () => {
    const journal = [
      recorded('first-footstep'),
      recorded('rookwood-plaque-thicket-found', 'Segunda placa'),
      recorded('rookwood-quest-accepted', 'Encargo de Edda'),
      recorded('rookwood-plaque-hollow-found', 'Primera placa'),
    ];
    expect(chroniclesQuestRecordedEvents({ id: 'names-in-wood', status: 'active' }, journal)
      .map((entry) => entry.title)).toEqual(['Segunda placa', 'Encargo de Edda', 'Primera placa']);
    expect(chroniclesQuestRecordedEvents({ id: 'names-in-wood', status: 'completed' }, []))
      .toEqual([]);
  });

  it('does not fabricate milestones when the quest is finished or its log is absent', () => {
    expect(chroniclesQuestRecordedEvents({ id: 'banner-contract', status: 'completed' },
      [recorded('first-footstep')])).toEqual([]);
    expect(chroniclesQuestRecordedEvents({ id: 'unknown-quest' },
      [recorded('first-book-banner-found')])).toEqual([]);
    expect(chroniclesQuestRecordedEvents(null, null)).toEqual([]);
  });

  it('does not duplicate corrupt repeated receipts or render events without text', () => {
    const events = [
      recorded('first-book-contract-accepted'),
      recorded('first-book-contract-accepted'),
      { id: 'first-book-banner-found', title: 'Hallado' },
    ];
    expect(chroniclesQuestRecordedEvents({ id: 'banner-contract' }, events).map((event) => event.id))
      .toEqual(['first-book-contract-accepted']);
  });

  it('links exclusively to authored world journal IDs and no speculative event descriptions', () => {
    const authored = new Set([
      ...authoredReceiptIds(swordhaven),
      ...authoredReceiptIds(bannerRoad),
      ...authoredReceiptIds(rookwood),
    ]);
    for (const [questId, ids] of Object.entries(questEventLinks)) {
      expect(questId.length).toBeGreaterThan(0);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(authored.has(id)).toBe(true);
    }
  });
});
