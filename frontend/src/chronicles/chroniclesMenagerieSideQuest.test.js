import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesTacticsInteractions,
  chroniclesTacticsUse,
} from '../chroniclesOfMatthiasTactics.js';
import {
  chroniclesActiveQuest,
  chroniclesApplyContentEffects,
  chroniclesInventoryEntries,
  chroniclesQuestEntries,
} from './chroniclesContentRuntime.js';
import {
  chroniclesMapById,
  chroniclesMapTransitionState,
} from './chroniclesMapCatalog.js';

describe('Chronicles Menagerie ember side quest', () => {
  it('chains clue, optional enemy loot and treasure into a complete authored side quest', () => {
    const map = chroniclesMapById('menagerie-of-ash');
    const wisp = map.enemies.find((enemy) => enemy.id === 'ember-wisp');
    let state = chroniclesMapTransitionState(createChroniclesState(), map.id);

    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'ember-scorchmarks',
      label: 'Examinar marcas de brasa',
    }));

    state = chroniclesTacticsUse(state, 'ember-scorchmarks');
    expect(chroniclesActiveQuest(state)).toMatchObject({
      id: 'embers-under-stone',
      title: 'Brasa bajo piedra',
      status: 'active',
      objective: 'Investiga al fuego fatuo sin perder de vista la salida.',
    });
    expect(state.journal.at(-1)?.id).toBe('ember-scorchmarks-read');

    state = chroniclesApplyContentEffects(state, wisp.onDefeat.effects);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'ember-shard',
      name: 'Fragmento de Brasa',
      quantity: 1,
    }));
    expect(chroniclesActiveQuest(state)?.objective).toBe('Encuentra dónde encaja el Fragmento de Brasa.');

    state = {
      ...state,
      x: 3,
      y: 1,
      party: state.party.map((member) => ({ ...member, hp: Math.max(1, member.hp - 2) })),
    };
    const woundedHp = state.party.map((member) => member.hp);
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'ember-cache',
      label: 'Abrir alijo de brasa',
    }));

    const opened = chroniclesTacticsUse(state, 'ember-cache');
    expect(opened.emberCacheOpened).toBe(true);
    expect(chroniclesInventoryEntries(opened).map((item) => item.id)).not.toContain('ember-shard');
    expect(chroniclesQuestEntries(opened).find((quest) => quest.id === 'embers-under-stone')).toMatchObject({
      status: 'completed',
      objective: 'Alijo recuperado.',
    });
    opened.party.forEach((member, index) => expect(member.hp).toBeGreaterThanOrEqual(woundedHp[index]));
    expect(opened.journal.at(-1)?.id).toBe('ember-cache-opened');
  });

  it('keeps the entire side quest optional for the main campaign continuation', () => {
    const state = {
      ...chroniclesMapTransitionState(createChroniclesState(), 'menagerie-of-ash'),
      x: 4,
      y: 1,
      ashGoblinHp: 0,
      cryptSpiderHp: 0,
      boneHoundHp: 0,
      emberWispHp: 4,
    };

    const next = chroniclesTacticsUse(state, 'menagerie-gate');
    expect(next.mapId).toBe('blind-king-archive');
    expect(next.phase).toBe('explore');
    expect(next.archiveWispHp).toBe(4);
    expect(chroniclesInventoryEntries(next)).toEqual([]);
    expect(chroniclesQuestEntries(next)).toEqual([]);
  });
});

describe('Menagerie discovery in reverse order', () => {
  it('reads the initial clue after the wisp falls without resetting the quest', () => {
    const map = chroniclesMapById('menagerie-of-ash');
    const wisp = map.enemies.find(enemy => enemy.id === 'ember-wisp');
    const base = chroniclesMapTransitionState(createChroniclesState(), map.id);
    const won = chroniclesApplyContentEffects({ ...base, [wisp.hpKey]: 0 }, wisp.onDefeat.effects);
    expect(chroniclesActiveQuest(won)?.objective).toBe('Encuentra dónde encaja el Fragmento de Brasa.');
    const read = chroniclesTacticsUse(won, 'ember-scorchmarks');
    expect(read.emberClueRead).toBe(true);
    expect(read.journal.at(-1)?.id).toBe('ember-scorchmarks-read');
    expect(chroniclesActiveQuest(read)).toEqual(chroniclesActiveQuest(won));
    expect(read.inventory['ember-shard'].quantity).toBe(1);
    const opened = chroniclesTacticsUse({ ...read, x: 3, y: 1 }, 'ember-cache');
    expect(opened.emberCacheOpened).toBe(true);
    expect(chroniclesQuestEntries(opened).find(quest => quest.id === 'embers-under-stone')?.status).toBe('completed');
  });
});
