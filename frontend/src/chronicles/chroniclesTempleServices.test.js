import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesPartyArmorClass, chroniclesReduce } from '../chroniclesOfMatthias.js';
import { chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
import {
  chroniclesApplyTempleService, chroniclesTempleBlessingRemaining,
  chroniclesTempleServiceChoices, chroniclesTempleWithinReach,
} from './chroniclesTempleServices.js';

function atTemple(gold = 35) {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  return { ...state, x: 14, y: 6,
    inventory: { 'crown-gold': { id: 'crown-gold', name: 'Oro', quantity: gold } } };
}
const choice = (state, id) => chroniclesTempleServiceChoices(state)
  .find((entry) => entry.serviceId === id);

describe('Ilse temple services — priced MM3 campaign transactions', () => {
  it('offers four priced actions in her audience but not other town conversations', () => {
    const state = atTemple();
    const dialogue = chroniclesNpcDialogueForState(state);
    expect(dialogue.room).toBe('temple');
    expect(dialogue.treasury).toContain('35');
    expect(dialogue.choices.filter((entry) => entry.kind === 'temple-service')).toHaveLength(4);
    expect(dialogue.choices.filter((entry) => entry.kind === 'say')).toHaveLength(2);
    expect(dialogue.choices.at(-1).kind).toBe('leave');
    const mayor = { ...state, x: 11, y: 10 };
    expect(chroniclesTempleServiceChoices(mayor)).toEqual([]);
    expect(chroniclesNpcDialogueForState(mayor).choices.some((item) => item.kind === 'temple-service'))
      .toBe(false);
  });

  it('heals only wounded living heroes, charges five coins atomically, and never resurrects', () => {
    const start = atTemple(20);
    const wounded = { ...start, party: start.party.map((member, index) => ({
      ...member, hp: index === 0 ? 0 : index === 1 ? 1 : member.maxHp,
    })) };
    expect(choice(wounded, 'heal').disabled).toBe(false);
    const next = chroniclesReduce(wounded, { type: 'temple-service', serviceId: 'heal' });
    expect(chroniclesGoldBalance(next)).toBe(15);
    expect(next.party[0].hp).toBe(0);
    expect(next.party[1].hp).toBe(next.party[1].maxHp);
    expect(next.party[2].hp).toBe(next.party[2].maxHp);
    expect(next.turns).toBe(wounded.turns + 1);
    expect(chroniclesReduce(next, { type: 'temple-service', serviceId: 'heal' })).toBe(next);
  });

  it('revives actual fallen heroes; refuses to charge when nobody is down or funds are missing', () => {
    const start = atTemple(10);
    expect(choice(start, 'revive').disabled).toBe(true);
    expect(chroniclesApplyTempleService(start, 'revive')).toBe(start);
    const fallen = { ...start, party: start.party.map((m, i) => ({
      ...m, hp: i === 0 ? 0 : m.maxHp,
    })) };
    const raised = chroniclesReduce(fallen, { type: 'temple-service', serviceId: 'revive' });
    expect(raised.party[0].hp).toBe(Math.min(raised.party[0].maxHp, 21));
    expect(chroniclesGoldBalance(raised)).toBe(0);
    expect(raised.inventory['crown-gold']).toBeUndefined();
    const poor = { ...fallen, inventory: {} };
    expect(choice(poor, 'revive').reason).toMatch(/insuficiente/i);
    expect(chroniclesReduce(poor, { type: 'temple-service', serviceId: 'revive' })).toBe(poor);
  });

  it('purifies only recorded disease/poison, preserves unrelated conditions and refuses idle charges', () => {
    const start = atTemple(12);
    expect(choice(start, 'purify').disabled).toBe(true);
    expect(chroniclesReduce(start, { type: 'temple-service', serviceId: 'purify' })).toBe(start);
    const afflicted = { ...start, party: start.party.map((m, i) => ({
      ...m, ...(i === 0 ? { ailments: ['disease', 'exhaustion', 'poison'] } : {}),
    })) };
    const cured = chroniclesReduce(afflicted, { type: 'temple-service', serviceId: 'purify' });
    expect(cured.party[0].ailments).toEqual(['exhaustion']);
    expect(chroniclesGoldBalance(cured)).toBe(6);
    expect(chroniclesReduce(cured, { type: 'temple-service', serviceId: 'purify' })).toBe(cured);
  });

  it('donations grant real +2 AC for 12 consumed actions, never stack or refresh for free', () => {
    const start = atTemple(28);
    const base = chroniclesPartyArmorClass(start, 'rook');
    const blessed = chroniclesReduce(start, { type: 'temple-service', serviceId: 'donate' });
    expect(chroniclesGoldBalance(blessed)).toBe(20);
    expect(blessed.turns).toBe(start.turns + 1);
    expect(chroniclesPartyArmorClass(blessed, 'rook')).toBe(base + 2);
    expect(chroniclesTempleBlessingRemaining(blessed)).toBe(12);
    expect(choice(blessed, 'donate').disabled).toBe(true);
    expect(chroniclesReduce(blessed, { type: 'temple-service', serviceId: 'donate' })).toBe(blessed);
    // Serialized checkpoint preserves the receipt; passage of turns determines
    // expiration without a wall-clock timer or a second persistent store.
    let saved = JSON.parse(JSON.stringify(blessed));
    for (let n = 0; n < 11; n += 1) saved = chroniclesReduce(saved, 'turn-left');
    expect(chroniclesPartyArmorClass(saved, 'rook')).toBe(base + 2);
    saved = chroniclesReduce(saved, 'turn-left');
    expect(chroniclesTempleBlessingRemaining(saved)).toBe(0);
    expect(chroniclesPartyArmorClass(saved, 'rook')).toBe(base);
    const second = chroniclesReduce(saved, { type: 'temple-service', serviceId: 'donate' });
    expect(chroniclesGoldBalance(second)).toBe(12);
    expect(chroniclesTempleBlessingRemaining(second)).toBe(12);
  });

  it('cannot spend away from the temple, during initiative, or in Tactics mode', () => {
    const start = atTemple();
    const proposals = [
      { ...start, x: 1, y: 1 },
      { ...start, mapId: 'terra-a1' },
      { ...start, phase: 'defeated' },
      { ...start, initiative: { order: [] } },
      { ...start, combatRules: null },
      { ...start, x: 13, y: 6, direction: 3 },
    ];
    for (const state of proposals) {
      expect(chroniclesTempleWithinReach(state)).toBe(false);
      expect(chroniclesReduce(state, { type: 'temple-service', serviceId: 'donate' })).toBe(state);
    }
    expect(chroniclesReduce(start, { type: 'temple-service', serviceId: 'nonexistent' })).toBe(start);
  });
});
