import { describe, expect, it } from 'vitest';
import { chroniclesContextualContentAction, chroniclesPartyAttackStats, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  grantChroniclesMM3TemporaryBoon,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';
import {
  chroniclesResolveTemporaryFountainBoon,
  WOLF_FOUNTAIN_BOON,
  FROST_FOUNTAIN_BOON,
  LIGHTHOUSE_FOUNTAIN_BOON,
} from './chroniclesTemporaryFountainBoon.js';

function wolfFountainStart(progression = createChroniclesProgression(), rules = 'mm3') {
  const base = applyChroniclesProgressionToTacticsState(
    createChroniclesState('terra-b2', progression.characterBuild, { rules }),
    progression,
  );
  return { ...base, x: 5, y: 4, direction: 0, runProgression: progression };
}

function frostFountainStart(progression = createChroniclesProgression(), rules = 'mm3') {
  const base = applyChroniclesProgressionToTacticsState(
    createChroniclesState('terra-e1', progression.characterBuild, { rules }),
    progression,
  );
  return { ...base, x: 5, y: 10, direction: 0, runProgression: progression };
}

function lighthouseFountainStart(progression = createChroniclesProgression(), rules = 'mm3') {
  const base = applyChroniclesProgressionToTacticsState(
    createChroniclesState('terra-a6', progression.characterBuild, { rules }),
    progression,
  );
  return { ...base, x: 15, y: 4, direction: 0, runProgression: progression };
}

function act(state, progression, action) {
  const reduced = chroniclesReduce(state, action);
  return chroniclesResolveTemporaryFountainBoon(state, reduced, progression);
}

describe('MM3: twelve-action Luck blessing at the real Wolf Fountain', () => {
  it('awards +2 real Luck to the group only after the authored one-time healing action', () => {
    const progression = createChroniclesProgression();
    const state = wolfFountainStart(progression);
    expect(chroniclesContextualContentAction(state)?.id).toBe(WOLF_FOUNTAIN_BOON.sourceId);
    expect(state.party[0].mm3.temporaryBoon).toBeNull();
    expect(state.terra_b2ShrineUsed).not.toBe(true);
    const action = act(state, progression, { type: 'interact' });
    expect(action.granted).toBe(true);
    expect(action.updated).toBe(true);
    expect(action.state.terra_b2ShrineUsed).toBe(true);
    expect(action.state.turns).toBe(state.turns + 1);
    expect(action.state.message).toContain('+2 Suerte');
    expect(action.progression.mm3TemporaryBoon).toEqual({
      sourceId: WOLF_FOUNTAIN_BOON.sourceId, stat: 'luck', amount: 2,
      expiresAtTurn: action.state.turns + 12,
    });
    expect(action.progression.claimedTemporaryWorldSources).toEqual([WOLF_FOUNTAIN_BOON.sourceId]);
    for (const [index, hero] of action.state.party.entries()) {
      expect(hero.mm3.stats.luck).toBe(state.party[index].mm3.stats.luck + 2);
      expect(hero.mm3.temporaryBoon.amount).toBe(2);
      expect(hero.characterBuild.stats.luck).toBe(state.party[index].characterBuild.stats.luck);
      expect(hero.hp).toBe(state.party[index].hp);
      expect(hero.maxHp).toBe(state.party[index].maxHp);
    }
    expect(action.progression.heroes.matthias.mm3WorldBonuses.luck).toBe(0);
    expect(action.progression.heroes.rook.attributes).toEqual(progression.heroes.rook.attributes);
    // Neither walking into a well nor opening a sheet grants the blessing.
    expect(chroniclesResolveTemporaryFountainBoon(state, state, progression).granted).toBe(false);
  });

  it('expires after exactly twelve real actions, survives transitions and save/resume', () => {
    let progression = createChroniclesProgression();
    let current = wolfFountainStart(progression);
    const started = act(current, progression, { type: 'interact' });
    expect(started.granted).toBe(true);
    expect(started.expiredNotice).toBeNull();
    progression = started.progression;
    current = started.state;
    const initialLuck = wolfFountainStart().party.map((h) => h.mm3.stats.luck);

    for (let i = 0; i < 5; i += 1) {
      const result = act(current, progression, { type: 'turn-right' });
      expect(result.granted).toBe(false);
      expect(result.updated).toBe(true);
      current = result.state;
    }
    expect(current.party[0].mm3.stats.luck).toBe(initialLuck[0] + 2);

    // The same turn counter is preserved when crossing into a different region.
    const traveled = chroniclesMapTransitionState(current, 'terra-e1');
    expect(traveled.turns).toBe(current.turns);
    current = traveled;

    const checkpoint = chroniclesRunCheckpointPayload(current, 4);
    const loadedProgression = chroniclesCheckpointRunProgression(checkpoint);
    expect(loadedProgression.mm3TemporaryBoon).toEqual(progression.mm3TemporaryBoon);
    expect(loadedProgression.claimedTemporaryWorldSources).toEqual([WOLF_FOUNTAIN_BOON.sourceId]);
    const resumed = chroniclesApplyRunCheckpoint(createChroniclesState('terra-e1',
      progression.characterBuild, { rules: 'mm3' }), checkpoint);
    current = reconcileChroniclesProgressionInTacticsState(resumed, loadedProgression);
    expect(current.turns).toBe(traveled.turns);
    expect(current.party[0].mm3.stats.luck).toBe(initialLuck[0] + 2);
    progression = loadedProgression;

    for (let i = 0; i < 7; i += 1) {
      const previous = current;
      const result = act(current, progression, { type: 'turn-left' });
      expect(result.state.turns).toBe(previous.turns + 1);
      expect(result.expiredNotice).toBe(i === 6
        ? 'Se desvanece la bendición de la Fuente de los Lobos (+2 Suerte).'
        : null);
      current = result.state;
    }
    expect(current.turns).toBe(progression.mm3TemporaryBoon.expiresAtTurn);
    current.party.forEach((hero, i) => {
      expect(hero.mm3.stats.luck).toBe(initialLuck[i]);
      expect(hero.mm3.temporaryBoon).toBeNull();
    });

    const expired = chroniclesRunCheckpointPayload(current, 5);
    const expiredProgression = chroniclesCheckpointRunProgression(expired);
    const saved = chroniclesApplyRunCheckpoint(createChroniclesState('terra-e1',
      progression.characterBuild, { rules: 'mm3' }), expired);
    const refreshed = reconcileChroniclesProgressionInTacticsState(saved, expiredProgression);
    expect(refreshed.party.map((hero) => hero.mm3.stats.luck)).toEqual(initialLuck);
  });

  it('grants the authentic Frost Fountain +2 Speed for ten actions, never an unlisted well', () => {
    const progression = createChroniclesProgression();
    const initial = frostFountainStart(progression);
    expect(chroniclesContextualContentAction(initial)?.id).toBe(FROST_FOUNTAIN_BOON.sourceId);
    const claimed = act(initial, progression, { type: 'interact' });
    expect(claimed.granted).toBe(true);
    expect(claimed.state.terra_e1ShrineUsed).toBe(true);
    expect(claimed.state.message).toContain('+2 Velocidad');
    expect(claimed.state.message).toContain('10 acciones');
    expect(claimed.progression.mm3TemporaryBoon).toEqual({
      sourceId: FROST_FOUNTAIN_BOON.sourceId,
      stat: 'speed', amount: 2,
      expiresAtTurn: claimed.state.turns + 10,
    });
    claimed.state.party.forEach((hero, i) => {
      expect(hero.mm3.stats.speed).toBe(initial.party[i].mm3.stats.speed + 2);
      expect(hero.mm3.stats.luck).toBe(initial.party[i].mm3.stats.luck);
      expect(hero.mm3.worldBonuses.speed).toBe(0);
      expect(hero.characterBuild.stats.speed).toBe(initial.party[i].characterBuild.stats.speed);
    });
    const saved = chroniclesRunCheckpointPayload(claimed.state, 9);
    const restoredProgression = chroniclesCheckpointRunProgression(saved);
    expect(restoredProgression.claimedTemporaryWorldSources).toEqual([FROST_FOUNTAIN_BOON.sourceId]);
    const resumed = reconcileChroniclesProgressionInTacticsState(
      chroniclesApplyRunCheckpoint(createChroniclesState('terra-e1',
        progression.characterBuild, { rules: 'mm3' }), saved),
      restoredProgression,
    );
    expect(resumed.party[0].mm3.stats.speed).toBe(initial.party[0].mm3.stats.speed + 2);
    expect(chroniclesResolveTemporaryFountainBoon(resumed, resumed, restoredProgression).granted).toBe(false);

    let current = resumed;
    for (let i = 0; i < 10; i += 1) {
      const result = act(current, restoredProgression, { type: 'turn-right' });
      expect(result.state.turns).toBe(current.turns + 1);
      current = result.state;
    }
    expect(current.party.map((hero) => hero.mm3.stats.speed))
      .toEqual(initial.party.map((hero) => hero.mm3.stats.speed));
    expect(current.party.every((hero) => hero.mm3.temporaryBoon === null)).toBe(true);
    expect(chroniclesResolveTemporaryFountainBoon(current, current, restoredProgression).expiredNotice).toBeNull();
    expect(chroniclesResolveTemporaryFountainBoon(current, current, restoredProgression).granted).toBe(false);
    expect(act(frostFountainStart(progression, null), progression, { type: 'interact' }).granted).toBe(false);
  });

  it('replaces an active Wolf blessing at the Frost Fountain, never stacks them or restores the old one', () => {
    const base = createChroniclesProgression();
    const original = wolfFountainStart(base);
    const wolf = act(original, base, { type: 'interact' });
    expect(wolf.granted).toBe(true);
    const traveled = chroniclesMapTransitionState(wolf.state, 'terra-e1');
    const atFrost = { ...traveled, x: 5, y: 10, direction: 0,
      runProgression: wolf.progression };
    expect(chroniclesContextualContentAction(atFrost)?.id).toBe(FROST_FOUNTAIN_BOON.sourceId);
    const frost = act(atFrost, wolf.progression, { type: 'interact' });
    expect(frost.granted).toBe(true);
    expect(frost.progression.claimedTemporaryWorldSources)
      .toEqual([WOLF_FOUNTAIN_BOON.sourceId, FROST_FOUNTAIN_BOON.sourceId]);
    expect(frost.progression.mm3TemporaryBoon.sourceId).toBe(FROST_FOUNTAIN_BOON.sourceId);
    expect(frost.state.message).toContain('Sustituye a la bendición anterior');
    frost.state.party.forEach((hero, i) => {
      expect(hero.mm3.stats.luck).toBe(original.party[i].mm3.stats.luck);
      expect(hero.mm3.stats.speed).toBe(original.party[i].mm3.stats.speed + 2);
    });
    expect(chroniclesResolveTemporaryFountainBoon(
      { ...atFrost, terra_e1ShrineUsed: true },
      { ...frost.state, terra_e1ShrineUsed: true }, frost.progression,
    ).granted).toBe(false);
    expect(grantChroniclesMM3TemporaryBoon(
      frost.progression, WOLF_FOUNTAIN_BOON.sourceId, 'luck', 2, 99,
    ).granted).toBe(false);
  });

  it('gives all heroes +3 Accuracy for 8 turns at the Lighthouse, affecting actual hit rolls', () => {
    const progression = createChroniclesProgression();
    const original = lighthouseFountainStart(progression);
    expect(chroniclesContextualContentAction(original)?.id).toBe(LIGHTHOUSE_FOUNTAIN_BOON.sourceId);
    const beforeHit = original.party.map((member) => chroniclesPartyAttackStats(original, member.id).toHit);
    const claimed = act(original, progression, { type: 'interact' });
    expect(claimed.granted).toBe(true);
    expect(claimed.updated).toBe(true);
    expect(claimed.state.terra_a6ShrineUsed).toBe(true);
    expect(claimed.state.message).toContain('Fuente del Faro');
    expect(claimed.state.message).toContain('+3 Precisión');
    expect(claimed.state.message).toContain('8 acciones');
    expect(claimed.progression.mm3TemporaryBoon).toEqual({
      sourceId: LIGHTHOUSE_FOUNTAIN_BOON.sourceId, stat: 'accuracy',
      amount: 3, expiresAtTurn: claimed.state.turns + 8,
    });
    expect(claimed.progression.claimedTemporaryWorldSources).toEqual([LIGHTHOUSE_FOUNTAIN_BOON.sourceId]);

    claimed.state.party.forEach((member, i) => {
      expect(member.mm3.stats.accuracy).toBe(original.party[i].mm3.stats.accuracy + 3);
      expect(member.mm3.worldBonuses.accuracy).toBe(0);
      expect(member.characterBuild.stats.accuracy).toBe(original.party[i].characterBuild.stats.accuracy);
      expect(member.hp).toBe(original.party[i].hp);
      expect(member.maxHp).toBe(original.party[i].maxHp);
      // The derived bonus is consumed by the existing MM3 attack resolver,
      // not merely displayed in a character-sheet badge.
      expect(chroniclesPartyAttackStats(claimed.state, member.id).toHit).toBeGreaterThan(beforeHit[i]);
    });

    const saved = chroniclesRunCheckpointPayload(claimed.state, 7);
    const stored = chroniclesCheckpointRunProgression(saved);
    expect(stored.claimedTemporaryWorldSources).toContain(LIGHTHOUSE_FOUNTAIN_BOON.sourceId);
    const reloaded = reconcileChroniclesProgressionInTacticsState(
      chroniclesApplyRunCheckpoint(createChroniclesState('terra-a6',
        progression.characterBuild, { rules: 'mm3' }), saved), stored,
    );
    expect(reloaded.party[0].mm3.stats.accuracy).toBe(original.party[0].mm3.stats.accuracy + 3);
    expect(act(reloaded, stored, { type: 'interact' }).granted).toBe(false);

    let current = reloaded;
    for (let i = 0; i < 8; i += 1) {
      const result = act(current, stored, { type: 'turn-right' });
      expect(result.state.turns).toBe(current.turns + 1);
      expect(result.expiredNotice).toBe(i === 7
        ? 'Se desvanece la bendición de la Fuente del Faro (+3 Precisión).'
        : null);
      current = result.state;
    }
    expect(current.turns).toBe(stored.mm3TemporaryBoon.expiresAtTurn);
    expect(current.party.map((member) => member.mm3.stats.accuracy))
      .toEqual(original.party.map((member) => member.mm3.stats.accuracy));
    expect(current.party.every((member) => member.mm3.temporaryBoon === null)).toBe(true);
    expect(chroniclesResolveTemporaryFountainBoon(current, current, stored).updated).toBe(false);
    expect(act(lighthouseFountainStart(progression, null), progression, { type: 'interact' }).granted).toBe(false);
  });

  it('replaces Frost Speed with Lighthouse Accuracy after interregional travel without stacking', () => {
    const initialProgression = createChroniclesProgression();
    const before = frostFountainStart(initialProgression);
    const frost = act(before, initialProgression, { type: 'interact' });
    expect(frost.granted).toBe(true);
    const afterTravel = chroniclesMapTransitionState(frost.state, 'terra-a6');
    const next = { ...afterTravel, x: 15, y: 4, direction: 0, runProgression: frost.progression };
    expect(chroniclesContextualContentAction(next)?.id).toBe(LIGHTHOUSE_FOUNTAIN_BOON.sourceId);
    const claimed = act(next, frost.progression, { type: 'interact' });
    expect(claimed.granted).toBe(true);
    expect(claimed.progression.claimedTemporaryWorldSources)
      .toEqual([FROST_FOUNTAIN_BOON.sourceId, LIGHTHOUSE_FOUNTAIN_BOON.sourceId]);
    expect(claimed.progression.mm3TemporaryBoon.sourceId).toBe(LIGHTHOUSE_FOUNTAIN_BOON.sourceId);
    expect(claimed.state.message).toContain('Sustituye a la bendición anterior');
    expect(claimed.expiredNotice).toBeNull();
    claimed.state.party.forEach((member, i) => {
      expect(member.mm3.stats.speed).toBe(before.party[i].mm3.stats.speed);
      expect(member.mm3.stats.accuracy).toBe(before.party[i].mm3.stats.accuracy + 3);
    });
    expect(grantChroniclesMM3TemporaryBoon(
      claimed.progression, FROST_FOUNTAIN_BOON.sourceId, 'speed', 2, 90,
    ).granted).toBe(false);
    const returned = chroniclesMapTransitionState(claimed.state, 'terra-e1');
    expect(returned.terra_e1ShrineUsed).toBe(true);
    expect(act({ ...returned, x: 5, y: 10, direction: 0 },
      claimed.progression, { type: 'interact' }).granted).toBe(false);
  });

  it('notifies once when an enemy action passes the expiry boundary, but never on reload or invalid turns', () => {
    const progression = createChroniclesProgression();
    const awarded = act(wolfFountainStart(progression), progression, { type: 'interact' });
    expect(awarded.granted).toBe(true);
    const before = {
      ...awarded.state,
      turns: awarded.progression.mm3TemporaryBoon.expiresAtTurn - 1,
    };
    const expired = chroniclesResolveTemporaryFountainBoon(
      before, { ...before, turns: before.turns + 1 }, awarded.progression,
    );
    expect(expired.expiredNotice).toContain('Fuente de los Lobos');
    expect(expired.state.party[0].mm3.temporaryBoon).toBeNull();
    const again = chroniclesResolveTemporaryFountainBoon(
      expired.state, { ...expired.state, turns: expired.state.turns + 1 }, awarded.progression,
    );
    expect(again.expiredNotice).toBeNull();
    expect(chroniclesResolveTemporaryFountainBoon(
      before, before, awarded.progression,
    ).expiredNotice).toBeNull();
    expect(chroniclesResolveTemporaryFountainBoon(
      { ...before, turns: before.turns + 1 }, before, awarded.progression,
    ).expiredNotice).toBeNull();
    expect(chroniclesResolveTemporaryFountainBoon(
      { ...before, combatRules: null },
      { ...before, turns: before.turns + 1, combatRules: null },
      awarded.progression,
    ).expiredNotice).toBeNull();
    // No narratorial event or durable receipt changes when the toast appears.
    expect(expired.state.message).toBe(before.message);
    expect(expired.progression).toBe(awarded.progression);
  });

  it('refuses duplicates, malformed blessings, rewards in Tactics, and failed interactions', () => {
    const original = createChroniclesProgression();
    expect(grantChroniclesMM3TemporaryBoon(original, '', 'luck', 2, 12).granted).toBe(false);
    expect(grantChroniclesMM3TemporaryBoon(original, 'source-1', 'unknown', 2, 12).granted).toBe(false);
    expect(grantChroniclesMM3TemporaryBoon(original, 'source-1', 'luck', 30, 12).granted).toBe(false);
    expect(grantChroniclesMM3TemporaryBoon(original, 'source-1', 'luck', 2, -1).granted).toBe(false);
    const one = grantChroniclesMM3TemporaryBoon(original, 'source-1', 'luck', 2, 12);
    expect(one.granted).toBe(true);
    expect(grantChroniclesMM3TemporaryBoon(one.progression, 'source-1', 'luck', 2, 50).granted).toBe(false);
    const tactics = wolfFountainStart(original, null);
    expect(act(tactics, original, { type: 'interact' }).granted).toBe(false);
    expect(act(wolfFountainStart(original), original, { type: 'look' }).granted).toBe(false);
    const marked = { ...wolfFountainStart(one.progression), terra_b2ShrineUsed: true };
    expect(act(marked, one.progression, { type: 'interact' }).granted).toBe(false);
  });
});
