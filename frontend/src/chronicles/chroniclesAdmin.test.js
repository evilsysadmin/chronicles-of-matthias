import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { CHRONICLES_ADMIN_TRAVEL_KEY, chroniclesAdminDestinations } from './chroniclesAdmin.js';
import { chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const admin = (state, command, extra = {}) => chroniclesReduce(state, { type: 'admin', command, ...extra });

describe('Chronicles admin tools', () => {
  it('lists every map once, grouped into towns, dungeons and Terra', () => {
    const groups = chroniclesAdminDestinations();
    expect(groups.map((group) => group.id)).toEqual(['settlement', 'dungeon', 'wilderness']);
    const ids = groups.flatMap((group) => group.maps.map((map) => map.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('templo-corona-trono');
    expect(ids).toContain('molinoviejo');
  });

  it('never offers two destinations with the same label', () => {
    const groups = chroniclesAdminDestinations();
    const labels = groups.flatMap((group) => group.maps.map((map) => map.label));
    expect(new Set(labels).size).toBe(labels.length);
    const towns = Object.fromEntries(groups[0].maps.map((map) => [map.id, map.label]));
    expect(towns['swordhaven-first-book']).toBe('Swordhaven');
    expect(towns['swordhaven-square']).toBeUndefined();
  });

  it('travels anywhere and marks the jump for the next checkpoint only in memory', () => {
    const state = admin(createChroniclesState('swordhaven-first-book'), 'travel', { mapId: 'templo-corona-trono' });
    expect(state.mapId).toBe('templo-corona-trono');
    expect(state[CHRONICLES_ADMIN_TRAVEL_KEY]).toBe(true);
    expect(chroniclesRunCheckpointPayload(state, 1).worldFlags).not.toHaveProperty(CHRONICLES_ADMIN_TRAVEL_KEY);
  });

  it('opens the final act with the tablet in hand at the temple door', () => {
    const state = admin(createChroniclesState('swordhaven-first-book'), 'act-five');
    expect(state.mapId).toBe('terra-f6');
    expect(state.lostKingFinalActOpen).toBe(true);
    expect(state.inventory['oath-tablet'].quantity).toBe(1);
    expect(state.quests['lost-king'].status).toBe('active');
  });

  it('grants gold, XP, items and flags', () => {
    let state = createChroniclesState('swordhaven-first-book');
    state = admin(state, 'gold');
    expect(chroniclesGoldBalance(state)).toBe(500);
    state = admin(state, 'xp');
    state = admin(state, 'xp');
    expect(state.xpAwards).toHaveLength(2);
    state = admin(state, 'item', { itemId: 'steel-sword', quantity: '2' });
    expect(state.inventory['steel-sword'].quantity).toBe(2);
    state = admin(state, 'flag', { key: 'varrenDefeated', value: 'true' });
    expect(state.varrenDefeated).toBe(true);
    state = admin(state, 'flag', { key: 'lostKingEnding', value: 'broken' });
    expect(state.lostKingEnding).toBe('broken');
  });
});
