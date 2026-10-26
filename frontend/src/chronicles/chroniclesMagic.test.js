import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import {
  chroniclesSpellTargetHotkey,
  chroniclesMemberMaxSp,
  chroniclesMemberSp,
  chroniclesMemberSpells,
} from './chroniclesMagic.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const member = (state, id) => state.party.find((entry) => entry.id === id);

function town(gold = 0) {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  return gold ? chroniclesApplyContentEffects(state, [{ type: 'grant-gold', amount: gold }]) : state;
}

describe('Chronicles · MM3 magic', () => {
  it('gives spell points by school and casting stat, half for hybrids, none for the knight', () => {
    const state = town();
    // Canonical company: Aziz cleric (PER 16, +2) full; Hildegard paladin (PER 13, +1) and
    // Faust archer (INT 13, +1) half; Matthias knight casts nothing.
    expect(chroniclesMemberMaxSp(state, member(state, 'bishop'))).toBe(5);
    expect(chroniclesMemberMaxSp(state, member(state, 'rook'))).toBe(2);
    expect(chroniclesMemberMaxSp(state, member(state, 'knight'))).toBe(2);
    expect(chroniclesMemberMaxSp(state, member(state, 'matthias'))).toBe(0);
    expect(chroniclesMemberSpells(state, member(state, 'matthias'))).toEqual([]);
    // Spell points grow with level.
    const veteran = { ...state, rpgModifiers: { bishop: { level: 3 } } };
    expect(chroniclesMemberMaxSp(veteran, member(veteran, 'bishop'))).toBe(15);
    // Starting books: Esoterica knows First Aid, Cosmonium knows Detect Magic.
    expect(chroniclesMemberSpells(state, member(state, 'bishop')).map((spell) => spell.id)).toEqual(['first-aid']);
    expect(chroniclesMemberSpells(state, member(state, 'knight')).map((spell) => spell.id)).toEqual(['detect-magic']);
  });

  it('applies chosen race to real magic capacity without giving noncasters PH', () => {
    const state = town();
    const cleric = member(state, 'bishop');
    const archer = member(state, 'knight');
    expect(chroniclesMemberMaxSp(state, { ...cleric, mm3: { ...cleric.mm3, raceId: 'gnome' } })).toBe(6);
    expect(chroniclesMemberMaxSp(state, { ...cleric, mm3: { ...cleric.mm3, raceId: 'elf' } })).toBe(5);
    expect(chroniclesMemberMaxSp(state, { ...archer, mm3: { ...archer.mm3, raceId: 'elf' } })).toBe(3);
  });

  it('routes 1–4 to party order only during unmodified discrete target selection', () => {
    const state = town();
    for (const [index, hero] of state.party.entries()) {
      expect(chroniclesSpellTargetHotkey({ key: String(index + 1) }, state.party)).toBe(hero.id);
    }
    for (const event of [
      { key: '0' }, { key: '5' }, { key: 'a' }, { key: 'Escape' },
      { key: '1', repeat: true }, { key: '2', shiftKey: true },
      { key: '3', ctrlKey: true }, { key: '4', metaKey: true },
      { key: '1', altKey: true }, { key: '2', isComposing: true },
    ]) expect(chroniclesSpellTargetHotkey(event, state.party)).toBeNull();
    expect(chroniclesSpellTargetHotkey({ key: '4' }, state.party.slice(0, 3))).toBeNull();
  });

  it('selects a real hero without spending HP, SP or turn until the cast is confirmed', () => {
    const base = town();
    const state = { ...base, party: base.party.map((hero) => (
      hero.id === 'matthias' ? { ...hero, hp: 3 } : hero
    )) };
    const turnBefore = state.turns;
    const spBefore = chroniclesMemberSp(state, member(state, 'bishop'));
    const targetId = chroniclesSpellTargetHotkey({ key: '1' }, state.party);
    expect(targetId).toBe('matthias');
    // Asking the question is presentation-only. The reducer is called once,
    // after the chosen living, wounded member has been validated.
    expect(state.turns).toBe(turnBefore);
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(spBefore);
    const healed = chroniclesReduce(state, { type: 'cast', memberId: 'bishop',
      spellId: 'first-aid', targetId });
    expect(member(healed, 'matthias').hp).toBe(9);
    expect(healed.turns).toBe(turnBefore + 1);
    expect(chroniclesMemberSp(healed, member(healed, 'bishop'))).toBe(spBefore - 1);
  });

  it('heals the most wounded ally with First Aid and the inn restores spell points', () => {
    let state = town(20);
    state = { ...state, party: state.party.map((entry) => entry.id === 'rook' ? { ...entry, hp: 2 } : entry) };
    state = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'first-aid' });
    expect(member(state, 'rook').hp).toBe(Math.min(member(state, 'rook').maxHp, 8));
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(4);
    expect(state.message).toMatch(/Primeros auxilios sobre Hildegard/);
    // Original MM3 allows a wasted cast at full health: it still costs SP/turn.
    const full = { ...state, party: state.party.map((entry) => ({ ...entry, hp: entry.maxHp })) };
    const fullCast = chroniclesReduce(full, { type: 'cast', memberId: 'bishop', spellId: 'first-aid' });
    expect(chroniclesMemberSp(fullCast, member(fullCast, 'bishop'))).toBe(3);
    expect(fullCast.turns).toBe(full.turns + 1);
    expect(fullCast.party).toEqual(full.party);
    expect(fullCast.message).toMatch(/ya está sano/i);
    // A spell the caster does not know is refused.
    const unknown = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'flying-fist' });
    expect(unknown.message).toMatch(/no conoce/);
    // Resting at the tavern refills the book.
    const tavern = chroniclesReduce({ ...state, x: 7, y: 10 }, 'interact');
    expect(tavern.inn?.id).toBe('first-book-healer');
    // Opening is free and does not magically restore PH; resting is explicit.
    expect(chroniclesMemberSp(tavern, member(tavern, 'bishop'))).toBe(4);
    const rested = chroniclesReduce(tavern, { type: 'inn-rest' });
    expect(chroniclesMemberSp(rested, member(rested, 'bishop'))).toBe(5);
    expect(rested.spellPoints).toBeUndefined();
  });

  it('targets a chosen wounded ally, not merely the automatically most wounded one', () => {
    const base = town();
    const state = { ...base, party: base.party.map((hero) => (
      hero.id === 'rook' ? { ...hero, hp: 1 }
        : hero.id === 'matthias' ? { ...hero, hp: 4 } : hero
    )) };
    const targeted = chroniclesReduce(state, {
      type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'matthias',
    });
    expect(member(targeted, 'matthias').hp).toBe(10);
    expect(member(targeted, 'rook').hp).toBe(1);
    expect(targeted.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(targeted, member(targeted, 'bishop'))).toBe(4);
    expect(targeted.message).toMatch(/Primeros auxilios sobre Matthias/);
    const legacy = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'first-aid' });
    expect(member(legacy, 'rook').hp).toBe(7);
  });

  it('explains that healing cannot revive a fallen target and spends neither SP nor turn', () => {
    const base = town();
    const state = { ...base, party: base.party.map((hero) => (
      hero.id === 'rook' ? { ...hero, hp: 0 }
        : hero.id === 'matthias' ? { ...hero, hp: 3 } : hero
    )) };
    for (const targetId of ['rook', 'nonexistent']) {
      const result = chroniclesReduce(state, {
        type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId,
      });
      expect(result.party).toEqual(state.party);
      expect(result.turns).toBe(state.turns);
      expect(chroniclesMemberSp(result, member(result, 'bishop'))).toBe(5);
      expect(result.message).toMatch(targetId === 'rook' ? /0 PV.*Elixir de retorno/ : /No existe/);
    }
    const allStandingFull = { ...state, party: state.party.map((hero) => (
      hero.hp > 0 ? { ...hero, hp: hero.maxHp } : hero
    )) };
    const noWounds = chroniclesReduce(allStandingFull, {
      type: 'cast', memberId: 'bishop', spellId: 'first-aid',
    });
    expect(noWounds.message).toMatch(/ya está sano/i);
    expect(noWounds.turns).toBe(allStandingFull.turns + 1);
    expect(chroniclesMemberSp(noWounds, member(noWounds, 'bishop'))).toBe(4);
  });

  it('sells membership and spells at the guild, only to casters of the matching force', () => {
    let state = { ...town(40), x: 15, y: 4 };
    state = chroniclesReduce(state, 'interact');
    expect(state.guild?.id).toBe('first-book-guild');
    // Not a member yet: no spell for sale.
    expect(chroniclesReduce(state, { type: 'guild-learn', memberId: 'bishop', spellId: 'flying-fist' })).toBe(state);
    state = chroniclesReduce(state, { type: 'guild-join' });
    expect(state.guildMemberships).toEqual({ 'first-book-guild': true });
    state = chroniclesReduce(state, { type: 'guild-learn', memberId: 'bishop', spellId: 'flying-fist' });
    expect(chroniclesMemberSpells(state, member(state, 'bishop')).map((spell) => spell.id)).toEqual(['first-aid', 'flying-fist']);
    // Cosmonium for the archer; the cleric cannot learn it, the knight learns nothing.
    state = chroniclesReduce(state, { type: 'guild-learn', memberId: 'knight', spellId: 'elemental-arrow' });
    expect(chroniclesReduce(state, { type: 'guild-learn', memberId: 'bishop', spellId: 'elemental-arrow' })).toBe(state);
    expect(chroniclesReduce(state, { type: 'guild-learn', memberId: 'matthias', spellId: 'first-aid' })).toBe(state);
    // 40 − 10 membership − 12 − 15 = 3 gold left: nothing else is affordable.
    expect(state.inventory['crown-gold'].quantity).toBe(3);
    const broke = chroniclesReduce(state, { type: 'guild-learn', memberId: 'rook', spellId: 'flying-fist' });
    expect(broke.message).toMatch(/no llega/);
    // Walking away closes the counter; the books survive a checkpoint.
    const walked = chroniclesReduce(state, 'turn-left');
    expect(walked.guild).toBeUndefined();
    const spent = { ...walked, spellPoints: { bishop: 1 } };
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      chroniclesRunCheckpointPayload(spent, 4),
    );
    expect(chroniclesMemberSpells(restored, member(restored, 'knight')).map((spell) => spell.id))
      .toEqual(['detect-magic', 'elemental-arrow']);
    expect(chroniclesMemberSp(restored, member(restored, 'bishop'))).toBe(1);
    expect(restored.guildMemberships).toEqual({ 'first-book-guild': true });
  });

  it('casts offensive spells that never miss, at their own reach, spending spell points', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    // Two cells south of the deserter, facing north.
    let state = { ...base, x: 11, y: 7, direction: 0, spellbook: { bishop: ['first-aid', 'flying-fist'] } };
    const hpBefore = state.bannerRoadDeserterHp;
    state = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'flying-fist' });
    expect(state.bannerRoadDeserterHp).toBe(Math.max(0, hpBefore - 6));
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(3);
    expect(state.message).toMatch(/Puño volador/);
    // Out of spell points: refused without a turn.
    const drained = { ...state, spellPoints: { bishop: 1 } };
    const refused = chroniclesReduce(drained, { type: 'cast', memberId: 'bishop', spellId: 'flying-fist' });
    expect(refused.turns).toBe(drained.turns);
    expect(refused.message).toMatch(/puntos de hechizo/);
  });

  it('detects unopened treasure in the area', () => {
    const state = createChroniclesState('ash-vault', null, { rules: 'mm3' });
    const cast = chroniclesReduce(state, { type: 'cast', memberId: 'knight', spellId: 'detect-magic' });
    expect(cast.message).toMatch(/Queda un tesoro sin abrir/);
    expect(chroniclesMemberSp(cast, member(cast, 'knight'))).toBe(1);
  });
});


describe('MM3 full-health healing remains a real cast', () => {
  it('lets the player deliberately waste a chosen single-target cure but not revive the fallen', () => {
    const state = town();
    const before = chroniclesMemberSp(state, member(state, 'bishop'));
    const result = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'matthias' });
    expect(result.party).toEqual(state.party);
    expect(result.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(result, member(result, 'bishop'))).toBe(before - 1);
    expect(result.message).toMatch(/no recupera PV/i);
    const fallen = { ...state, party: state.party.map((hero) => hero.id === 'matthias' ? { ...hero, hp: 0 } : hero) };
    const refused = chroniclesReduce(fallen, { type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'matthias' });
    expect(refused.turns).toBe(fallen.turns);
    expect(chroniclesMemberSp(refused, member(refused, 'bishop'))).toBe(before);
  });

  it('casts mass heal on an entirely healthy living company with no HP delta', () => {
    const base = town();
    const state = { ...base, rpgModifiers: { bishop: { level: 2 } },
      spellbook: { bishop: ['first-aid', 'mass-heal'] }, spellPoints: { bishop: 7 } };
    const result = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'mass-heal' });
    expect(result.turns).toBe(state.turns + 1);
    expect(result.party).toEqual(state.party);
    expect(chroniclesMemberSp(result, member(result, 'bishop'))).toBe(1);
    expect(result.message).toMatch(/todos están sanos/i);
    const wiped = { ...state, party: state.party.map((hero) => ({ ...hero, hp: 0 })) };
    expect(chroniclesReduce(wiped, { type: 'cast', memberId: 'bishop', spellId: 'mass-heal' }).turns)
      .toBe(wiped.turns);
  });
});
