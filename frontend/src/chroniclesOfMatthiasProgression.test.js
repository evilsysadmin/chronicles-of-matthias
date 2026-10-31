import { beforeEach, describe, expect, it } from 'vitest';
import { createChroniclesState } from './chroniclesOfMatthias.js';
import {
  CHRONICLES_DAMAGE_XP_PER_HP,
  chroniclesKillXpShares,
  CHRONICLES_PROGRESSION_STORAGE_KEY,
  CHRONICLES_RUN_STORAGE_KEY,
  CHRONICLES_TACTICS_RUN_STORAGE_KEY,
  applyChroniclesProgressionToTacticsState,
  applyChroniclesTacticsProgression,
  beginChroniclesTacticsRun,
  chroniclesCharacterBuild,
  chroniclesHeroProgress,
  chroniclesXpThresholdForLevel,
  createChroniclesProgression,
  ensureChroniclesTacticsRun,
  finishChroniclesTacticsRun,
  grantChroniclesXp,
  grantChroniclesMM3WorldStat,
  loadChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
  renewChroniclesTacticsRun,
  saveChroniclesProgression,
  setChroniclesCharacterBuild,
  spendChroniclesAttributePoint,
  unlockChroniclesSkill,
} from './chroniclesOfMatthiasProgression.js';
import { clearStorageMemoryFallback } from './safeStorage.js';
import { chroniclesMemberMaxSp } from './chronicles/chroniclesMagic.js';
import { chroniclesPartyAttackStats } from './chroniclesOfMatthias.js';

function tacticsStateFor(mapId, overrides = {}) {
  return {
    ...createChroniclesState(mapId),
    round: 1,
    turnPhase: 'party',
    enemyPositions: {},
    enemyTurnEvents: [],
    ...overrides,
  };
}

function tacticsState(overrides = {}) {
  return tacticsStateFor('crypt-eight-squares', overrides);
}

describe('Chronicles Tactics · progression', () => {
  it('migrates legacy progression to the exact canonical character build', () => {
    const legacy = {
      version: 1,
      heroes: createChroniclesProgression().heroes,
      claimedAwards: [],
    };

    const build = chroniclesCharacterBuild(legacy);
    expect(build.mode).toBe('canonical');
    expect(build.characters.map((character) => character.name)).toEqual([
      'Matthias',
      'Hildegard',
      'Aziz',
      'Faust',
    ]);
  });

  it('persists a valid MM3 company without changing Tactics profiles', () => {
    const base = createChroniclesProgression();
    const custom = {
      version: 2,
      mode: 'custom',
      characters: [
        { slotId: 'matthias', classId: 'barbarian', name: 'Greta', stats: { might: 17, intellect: 8, personality: 9, endurance: 16, speed: 12, accuracy: 13, luck: 10 } },
        { slotId: 'rook', classId: 'paladin', name: 'Hildegard', stats: { might: 14, intellect: 9, personality: 13, endurance: 15, speed: 10, accuracy: 11, luck: 11 } },
        { slotId: 'bishop', classId: 'sorcerer', name: 'Nadir', stats: { might: 7, intellect: 16, personality: 10, endurance: 9, speed: 12, accuracy: 12, luck: 12 } },
        { slotId: 'knight', classId: 'archer', name: 'Faust', stats: { might: 11, intellect: 13, personality: 10, endurance: 12, speed: 14, accuracy: 15, luck: 11 } },
      ],
    };

    const selected = setChroniclesCharacterBuild(base, custom);
    expect(selected.updated).toBe(true);
    const saved = saveChroniclesProgression(selected.progression);
    expect(loadChroniclesProgression().characterBuild.characters[0]).toMatchObject({ name: 'Greta', classId: 'barbarian' });

    const tactics = applyChroniclesProgressionToTacticsState(
      createChroniclesState(null, saved.characterBuild),
      saved,
    );
    expect(tactics.party.find((member) => member.id === 'matthias')).toMatchObject({ name: 'Greta', maxHp: 7 });
    expect(tactics.rpgModifiers.matthias.attackDamageBonus).toBe(0);
    expect(setChroniclesCharacterBuild(base, { ...custom, version: 1 }).updated).toBe(false);
  });

  beforeEach(() => {
    clearStorageMemoryFallback();
    localStorage.clear();
    localStorage.setItem('chess-study-auth-username', 'alice');
  });

  it('applies spent progression to the live tactical state without healing existing damage', () => {
    const leveled = grantChroniclesXp(
      createChroniclesProgression(),
      'rook',
      chroniclesXpThresholdForLevel(2),
      'fixture:live-vigor',
    ).progression;
    const initial = applyChroniclesProgressionToTacticsState(tacticsState(), leveled);
    const rookIndex = initial.party.findIndex((member) => member.id === 'rook');
    const wounded = {
      ...initial,
      party: initial.party.map((member, index) => (
        index === rookIndex ? { ...member, hp: Math.max(0, member.hp - 2) } : member
      )),
    };
    const before = wounded.party[rookIndex];
    const spent = spendChroniclesAttributePoint(leveled, 'rook', 'vigor');

    expect(spent.spent).toBe(true);
    const reconciled = reconcileChroniclesProgressionInTacticsState(wounded, spent.progression);
    const after = reconciled.party[rookIndex];

    expect(after.maxHp).toBe(before.maxHp + 1);
    expect(after.hp).toBe(before.hp);
    expect(reconciled.rpgModifiers.rook.bonusMaxHp).toBe(initial.rpgModifiers.rook.bonusMaxHp + 1);
  });

  it('automatically raises MM3 HP and PH by class and level, without healing wounds or changing Tactics', () => {
    const raw = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const initial = applyChroniclesProgressionToTacticsState(raw, createChroniclesProgression());
    const paladin = initial.party.find((member) => member.id === 'rook');
    expect(paladin.mm3.classId).toBe('paladin');
    const baseSp = chroniclesMemberMaxSp(initial, paladin);
    const gained = grantChroniclesXp(createChroniclesProgression(), 'rook', chroniclesXpThresholdForLevel(2), 'mm3:level2');
    const leveled = reconcileChroniclesProgressionInTacticsState(initial, gained.progression);
    const grown = leveled.party.find((member) => member.id === 'rook');
    expect(grown.maxHp).toBe(paladin.maxHp * 2);
    expect(grown.hp).toBe(paladin.hp); // Leveling alone never heals existing damage.
    expect(chroniclesMemberMaxSp(leveled, grown)).toBeGreaterThan(baseSp);
    // Reconciliation is idempotent and does not double count level growth.
    expect(reconcileChroniclesProgressionInTacticsState(leveled, gained.progression).party.find((member) => member.id === 'rook').maxHp).toBe(grown.maxHp);
    const tactics = applyChroniclesProgressionToTacticsState(tacticsState(), gained.progression);
    expect(tactics.party.find((member) => member.id === 'rook').maxHp).toBe(tacticsState().party.find((member) => member.id === 'rook').maxHp);
  });

  it('keeps discovered MM3 stats separate from the creator sheet and Tactics, and refuses replay/farming', () => {
    const base = createChroniclesProgression();
    expect(base.heroes.rook.mm3WorldBonuses.endurance).toBe(0);
    expect(grantChroniclesMM3WorldStat(base, 'rook', 'strength', 'crystal-1').granted).toBe(false);
    expect(grantChroniclesMM3WorldStat(base, 'unknown', 'endurance', 'crystal-1').granted).toBe(false);
    expect(grantChroniclesMM3WorldStat(base, 'rook', 'endurance', '').granted).toBe(false);
    const found = grantChroniclesMM3WorldStat(base, 'rook', 'endurance', 'crystal-1');
    expect(found.granted).toBe(true);
    expect(found.progression.characterBuild).toEqual(base.characterBuild);
    expect(found.progression.heroes.rook.attributes).toEqual(base.heroes.rook.attributes);
    expect(found.progression.heroes.rook.mm3WorldBonuses.endurance).toBe(1);
    expect(found.progression.claimedWorldStatSources).toEqual(['crystal-1']);
    expect(grantChroniclesMM3WorldStat(found.progression, 'matthias', 'might', 'crystal-1').granted).toBe(false);
    const saved = saveChroniclesProgression(found.progression);
    expect(loadChroniclesProgression().heroes.rook.mm3WorldBonuses.endurance).toBe(1);
    expect(loadChroniclesProgression().claimedWorldStatSources).toEqual(['crystal-1']);
    const tacticsBefore = applyChroniclesProgressionToTacticsState(tacticsState(), base);
    const tacticsAfter = applyChroniclesProgressionToTacticsState(tacticsState(), saved);
    expect(tacticsAfter.party).toEqual(tacticsBefore.party);
    expect(tacticsAfter.rpgModifiers).toEqual(tacticsBefore.rpgModifiers);
    const invalid = { ...saved, heroes: { ...saved.heroes, rook: {
      ...saved.heroes.rook, mm3WorldBonuses: { ...saved.heroes.rook.mm3WorldBonuses, endurance: 99999 },
    } } };
    expect(chroniclesHeroProgress(invalid, 'rook').mm3WorldBonuses.endurance).toBe(12);
  });

  it('applies MM3 discoveries to actual PV, damage, PH and initiative without compounding or healing', () => {
    let progression = grantChroniclesXp(createChroniclesProgression(), 'rook', chroniclesXpThresholdForLevel(2), 'level-2').progression;
    const state = applyChroniclesProgressionToTacticsState(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), progression,
    );
    const rook = state.party.find((hero) => hero.id === 'rook');
    progression = grantChroniclesMM3WorldStat(progression, 'rook', 'endurance', 'crystal-endurance-1').progression;
    progression = grantChroniclesMM3WorldStat(progression, 'rook', 'endurance', 'crystal-endurance-2').progression;
    const buffed = reconcileChroniclesProgressionInTacticsState(state, progression);
    const stronger = buffed.party.find((hero) => hero.id === 'rook');
    expect(stronger.maxHp).toBe(rook.maxHp + 2); // Level 2 and 15→17 Endurance crosses the bonus band.
    expect(stronger.hp).toBe(rook.hp);
    expect(stronger.mm3.stats.endurance).toBe(17);
    expect(stronger.mm3.worldBonuses.endurance).toBe(2);
    expect(stronger.characterBuild.stats.endurance).toBe(15);
    const twice = reconcileChroniclesProgressionInTacticsState(buffed, progression);
    expect(twice.party.find((hero) => hero.id === 'rook')).toEqual(stronger);

    let matthiasProgress = grantChroniclesMM3WorldStat(progression, 'matthias', 'might', 'stone-might-1').progression;
    matthiasProgress = grantChroniclesMM3WorldStat(matthiasProgress, 'matthias', 'might', 'stone-might-2').progression;
    let attackState = reconcileChroniclesProgressionInTacticsState(twice, matthiasProgress);
    expect(chroniclesPartyAttackStats(attackState, 'matthias').damage)
      .toBe(chroniclesPartyAttackStats(twice, 'matthias').damage + 1);
    matthiasProgress = grantChroniclesMM3WorldStat(matthiasProgress, 'matthias', 'speed', 'stone-speed').progression;
    attackState = reconcileChroniclesProgressionInTacticsState(attackState, matthiasProgress);
    expect(attackState.party.find((hero) => hero.id === 'matthias').mm3.stats.speed).toBe(13);

    let casterProgress = matthiasProgress;
    for (let i = 0; i < 3; i += 1) {
      casterProgress = grantChroniclesMM3WorldStat(casterProgress, 'bishop', 'personality', `font-personality-${i}`).progression;
    }
    const withMagic = reconcileChroniclesProgressionInTacticsState(attackState, casterProgress);
    const beforeCleric = attackState.party.find((hero) => hero.id === 'bishop');
    const afterCleric = withMagic.party.find((hero) => hero.id === 'bishop');
    expect(chroniclesMemberMaxSp(withMagic, afterCleric))
      .toBeGreaterThan(chroniclesMemberMaxSp(attackState, beforeCleric));
    expect(reconcileChroniclesProgressionInTacticsState(withMagic, casterProgress).party.find((hero) => hero.id === 'bishop').maxHp)
      .toBe(afterCleric.maxHp);
  });

  it('adds newly unlocked ability capacity without refilling charges already spent', () => {
    const base = createChroniclesProgression();
    const veteran = {
      ...base,
      heroes: {
        ...base.heroes,
        rook: {
          ...base.heroes.rook,
          xp: chroniclesXpThresholdForLevel(6),
          skillPoints: 1,
        },
      },
    };
    const initial = applyChroniclesProgressionToTacticsState(tacticsState(), veteran);
    const spentState = {
      ...initial,
      classAbilityCharges: {
        ...initial.classAbilityCharges,
        rook: 0,
      },
    };
    const learned = unlockChroniclesSkill(veteran, 'rook', 'rook-reserve-hammer');

    expect(learned.unlocked).toBe(true);
    const reconciled = reconcileChroniclesProgressionInTacticsState(spentState, learned.progression);

    expect(initial.rpgModifiers.rook.abilityCharges).toBe(1);
    expect(reconciled.rpgModifiers.rook.abilityCharges).toBe(2);
    expect(reconciled.classAbilityCharges.rook).toBe(1);
  });

  it('turns XP into bounded levels, attribute points and skill points', () => {
    const base = createChroniclesProgression();
    const levelTwoXp = chroniclesXpThresholdForLevel(2);
    const result = grantChroniclesXp(base, 'matthias', levelTwoXp, 'fixture:level-two');
    const hero = chroniclesHeroProgress(result.progression, 'matthias');

    expect(hero.level).toBe(2);
    expect(hero.xp).toBe(levelTwoXp);
    expect(hero.attributePoints).toBe(1);
    expect(hero.skillPoints).toBe(1);
    expect(result.levelUps).toEqual([{ memberId: 'matthias', from: 1, to: 2 }]);
  });

  it('never pays the same award twice', () => {
    const base = createChroniclesProgression();
    const first = grantChroniclesXp(base, 'rook', 12, 'crypt-01:fixture');
    const duplicate = grantChroniclesXp(first.progression, 'rook', 12, 'crypt-01:fixture');

    expect(first.awarded).toBe(12);
    expect(duplicate.awarded).toBe(0);
    expect(duplicate.duplicate).toBe(true);
    expect(chroniclesHeroProgress(duplicate.progression, 'rook').xp).toBe(12);
  });

  it('uses a fixed encounter XP budget inside one run but rewards a genuinely new expedition', () => {
    const before = tacticsState({ enemyHp: 6 });
    const after = tacticsState({ enemyHp: 0 });
    const first = applyChroniclesTacticsProgression(createChroniclesProgression(), before, after, {
      actorMemberId: 'rook',
      actionKind: 'ability',
      runId: 'run-before-f5',
    });
    const replay = applyChroniclesTacticsProgression(first.progression, before, after, {
      actorMemberId: 'rook',
      actionKind: 'ability',
      runId: 'run-before-f5',
    });
    const freshRun = applyChroniclesTacticsProgression(replay.progression, before, after, {
      actorMemberId: 'rook',
      actionKind: 'ability',
      runId: 'next-expedition',
    });

    expect(first.awards.some((award) => award.reason === 'daño útil')).toBe(true);
    expect(first.awards.some((award) => award.reason === 'baja')).toBe(true);
    expect(replay.awards).toEqual([]);
    expect(freshRun.awards.some((award) => award.reason === 'daño útil')).toBe(true);
    expect(freshRun.awards.some((award) => award.reason === 'baja')).toBe(true);
    expect(chroniclesHeroProgress(freshRun.progression, 'rook').xp)
      .toBeGreaterThan(chroniclesHeroProgress(first.progression, 'rook').xp);
  });

  it('does not let legacy cross-run claim ids poison future expeditions', () => {
    const seeded = grantChroniclesXp(
      createChroniclesProgression(),
      'rook',
      2,
      'crypt-01:damage:corrupted-pawn:hp-5',
    ).progression;
    const before = tacticsState({ enemyHp: 6 });
    const after = tacticsState({ enemyHp: 5 });

    const result = applyChroniclesTacticsProgression(seeded, before, after, {
      actorMemberId: 'rook',
      actionKind: 'attack',
      runId: 'legacy-profile',
    });

    expect(result.awards).toContainEqual(expect.objectContaining({
      awardId: 'legacy-profile:crypt-01:damage:corrupted-pawn:hp-5',
      reason: 'daño útil',
    }));
    expect(chroniclesHeroProgress(result.progression, 'rook').xp).toBe(2 + CHRONICLES_DAMAGE_XP_PER_HP);
  });

  it('gives each map an independent finite XP budget even when enemy ids are reused', () => {
    const cryptBefore = tacticsState({ enemyHp: 6 });
    const cryptAfter = tacticsState({ enemyHp: 5 });
    const crypt = applyChroniclesTacticsProgression(createChroniclesProgression(), cryptBefore, cryptAfter, {
      actorMemberId: 'rook',
      actionKind: 'attack',
      runId: 'campaign-run',
    });

    const galleryBefore = tacticsStateFor('gallery-of-forks', { enemyHp: 8 });
    const galleryAfter = tacticsStateFor('gallery-of-forks', { enemyHp: 7 });
    const gallery = applyChroniclesTacticsProgression(crypt.progression, galleryBefore, galleryAfter, {
      actorMemberId: 'rook',
      actionKind: 'attack',
      runId: 'campaign-run',
    });

    expect(crypt.awards).toContainEqual(expect.objectContaining({
      awardId: 'campaign-run:crypt-01:damage:corrupted-pawn:hp-5',
      reason: 'daño útil',
    }));
    expect(gallery.awards).toContainEqual(expect.objectContaining({
      awardId: 'campaign-run:gallery-01:damage:fork-stalker:hp-7',
      reason: 'daño útil',
    }));
  });

  it('ignores stale HP belonging to enemies outside the active map', () => {
    const before = tacticsStateFor('gallery-of-forks', { spectralBishopHp: 3 });
    const after = { ...before, spectralBishopHp: 2 };

    const result = applyChroniclesTacticsProgression(createChroniclesProgression(), before, after, {
      actorMemberId: 'rook',
      actionKind: 'attack',
      runId: 'gallery-run',
    });

    expect(result.awards).toEqual([]);
    expect(chroniclesHeroProgress(result.progression, 'rook').xp).toBe(0);
  });

  it('deduplicates objective, support and survival rewards inside a run but pays them in a new run', () => {
    const wounded = createChroniclesState().party.map((member) => ({ ...member, hp: Math.max(1, member.hp - 2) }));
    const healed = wounded.map((member) => ({ ...member, hp: Math.min(member.maxHp, member.hp + 2) }));
    const before = tacticsState({ party: wounded, sigilAwake: false, phase: 'explore' });
    const after = tacticsState({ party: healed, sigilAwake: true, phase: 'escaped' });

    const first = applyChroniclesTacticsProgression(createChroniclesProgression(), before, after, {
      actorMemberId: 'bishop',
      actionKind: 'ability',
      runId: 'first-run',
    });
    const replay = applyChroniclesTacticsProgression(first.progression, before, after, {
      actorMemberId: 'bishop',
      actionKind: 'ability',
      runId: 'first-run',
    });
    const freshRun = applyChroniclesTacticsProgression(replay.progression, before, after, {
      actorMemberId: 'bishop',
      actionKind: 'ability',
      runId: 'second-run',
    });

    expect(first.awards.some((award) => award.reason === 'soporte efectivo')).toBe(true);
    expect(first.awards.some((award) => award.reason === 'objetivo')).toBe(true);
    expect(first.awards.filter((award) => award.reason === 'supervivencia')).toHaveLength(4);
    expect(replay.awards).toEqual([]);
    expect(freshRun.awards.some((award) => award.reason === 'soporte efectivo')).toBe(true);
    expect(freshRun.awards.some((award) => award.reason === 'objetivo')).toBe(true);
    expect(freshRun.awards.filter((award) => award.reason === 'supervivencia')).toHaveLength(4);
  });

  it('persists progression through the registered profile key', () => {
    const awarded = grantChroniclesXp(createChroniclesProgression(), 'knight', 18, 'fixture:persist').progression;
    saveChroniclesProgression(awarded);
    const restored = loadChroniclesProgression();

    expect(localStorage.getItem(CHRONICLES_PROGRESSION_STORAGE_KEY)).toBeTruthy();
    expect(chroniclesHeroProgress(restored, 'knight').xp).toBe(18);
  });

  it('does not let the legacy v1 run key pin a fresh expedition after the random-entry fix', () => {
    localStorage.setItem('chess-study-chronicles-tactics-run-v1', JSON.stringify({
      id: 'legacy-crypt-run',
      owner: 'alice',
      ended: false,
    }));

    expect(CHRONICLES_TACTICS_RUN_STORAGE_KEY).toBe('chess-study-chronicles-tactics-run-v2');
    const current = ensureChroniclesTacticsRun();
    expect(current).not.toBe('legacy-crypt-run');

    const stored = JSON.parse(localStorage.getItem(CHRONICLES_RUN_STORAGE_KEY));
    expect(stored.id).toBe(current);
    expect(stored.owner).toBe('alice');
    expect(stored.ended).toBe(false);
  });

  it('creates a fresh run identity after the current expedition is finished', () => {
    const first = beginChroniclesTacticsRun();
    expect(ensureChroniclesTacticsRun()).toBe(first);

    expect(finishChroniclesTacticsRun(first)).toBe(true);

    const second = ensureChroniclesTacticsRun();
    expect(second).not.toBe(first);
    expect(ensureChroniclesTacticsRun()).toBe(second);
  });

  it('renews a stale active run once without clobbering a newer replacement', () => {
    const staleRun = beginChroniclesTacticsRun();
    const replacement = renewChroniclesTacticsRun(staleRun);

    expect(replacement).not.toBe(staleRun);
    expect(ensureChroniclesTacticsRun()).toBe(replacement);
    expect(renewChroniclesTacticsRun(staleRun)).toBe(replacement);
    expect(ensureChroniclesTacticsRun()).toBe(replacement);
  });

  it('keeps an active run across reload but refuses to inherit it across users', () => {
    const aliceRun = beginChroniclesTacticsRun();
    expect(ensureChroniclesTacticsRun()).toBe(aliceRun);

    localStorage.setItem('chess-study-auth-username', 'bob');
    const bobRun = ensureChroniclesTacticsRun();
    expect(bobRun).not.toBe(aliceRun);

    const stored = JSON.parse(localStorage.getItem(CHRONICLES_RUN_STORAGE_KEY));
    expect(stored.owner).toBe('bob');
  });

  it('shares a kill among living heroes and credits full-pool damage XP only to the striker', () => {
    const before = tacticsState({ enemyHp: 6 });
    const after = tacticsState({ enemyHp: 0 });
    const result = applyChroniclesTacticsProgression(createChroniclesProgression(), before, after, {
      actorMemberId: 'rook', actionKind: 'attack', runId: 'share-run',
    });
    const kills = result.awards.filter((entry) => entry.reason === 'baja');
    const shares = chroniclesKillXpShares({ id: 'corrupted-pawn', maxHp: 6 }, after.party);
    expect(kills.map((entry) => ({ memberId: entry.memberId, xp: entry.xp })))
      .toEqual(shares);
    expect(kills.reduce((sum, entry) => sum + entry.xp, 0)).toBe(11);
    const rookShare = shares.find((share) => share.memberId === 'rook')?.xp || 0;
    expect(chroniclesHeroProgress(result.progression, 'rook').xp)
      .toBe(rookShare + 3 * CHRONICLES_DAMAGE_XP_PER_HP);
  });

  it('pays healing XP for a healing spell as well as for an ability', () => {
    const base = tacticsState();
    const hurt = { ...base, party: base.party.map((member) => (member.id === 'rook' ? { ...member, hp: 1 } : member)) };
    const healed = { ...hurt, party: hurt.party.map((member) => (member.id === 'rook' ? { ...member, hp: 3 } : member)) };
    const result = applyChroniclesTacticsProgression(createChroniclesProgression(), hurt, healed, {
      actorMemberId: 'bishop', actionKind: 'cast', runId: 'heal-run',
    });
    expect(chroniclesHeroProgress(result.progression, 'bishop').xp).toBeGreaterThan(0);
  });
});
