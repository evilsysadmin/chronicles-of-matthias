import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import {
  applyChroniclesTacticsProgression,
  chroniclesHeroProgress,
  chroniclesKillXp,
  chroniclesKillXpShares,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';

const MAP_ID = 'swordhaven-sewers';

describe('Chronicles MM3 · exact finite kill XP budget', () => {
  const heroes = [{ id: 'matthias' }, { id: 'rook' }, { id: 'bishop' }, { id: 'knight' }];

  it('distributes the exact bounty even when it is smaller than the living company', () => {
    const mob = { id: 'sewers-goblin-west', maxHp: 4, killXp: 2 };
    const shares = chroniclesKillXpShares(mob, heroes);
    expect(shares).toHaveLength(2);
    expect(shares.map((entry) => entry.xp)).toEqual([1, 1]);
    expect(shares.reduce((sum, entry) => sum + entry.xp, 0)).toBe(2);
    expect(chroniclesKillXpShares(mob, heroes)).toEqual(shares);
    expect(new Set(shares.map((entry) => entry.memberId)).size).toBe(2);
  });

  it('retains the total bounty as allies fall, with no phantom XP recipients', () => {
    for (const alive of [1, 2, 3, 4]) {
      const living = heroes.slice(0, alive);
      for (const bounty of [0, 1, 2, 5, 9, 17]) {
        const shares = chroniclesKillXpShares({ id: 'balance-rotating-mob', killXp: bounty }, living);
        expect(shares.reduce((sum, share) => sum + share.xp, 0)).toBe(bounty);
        expect(shares.every(({ xp, memberId }) => xp > 0 && living.some((member) => member.id === memberId))).toBe(true);
        const xp = shares.map(({ xp: amount }) => amount);
        if (xp.length > 1) expect(Math.max(...xp) - Math.min(...xp)).toBeLessThanOrEqual(1);
      }
    }
    expect(chroniclesKillXpShares({ id: 'anything', killXp: 5 }, [])).toEqual([]);
    expect(chroniclesKillXpShares({ id: 'anything', killXp: 5 }, null)).toEqual([]);
    expect(chroniclesKillXpShares({ id: 'anything', killXp: 0 }, heroes)).toEqual([]);
    // Bad negative authoring never produces negative or infinite rewards.
    expect(chroniclesKillXpShares({ id: 'anything', killXp: -7, maxHp: 4 }, heroes)
      .reduce((sum, award) => sum + award.xp, 0)).toBe(9);
  });

  it('keeps the old two-damage-XP budget despite eight actual HP, split or all at once', () => {
    const map = chroniclesMapById(MAP_ID);
    const goblin = map.enemies.find((enemy) => enemy.id === 'sewers-goblin-west');
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    expect(base[goblin.hpKey]).toBe(8);
    expect(goblin.damageXpHpCap).toBe(4);

    function play(hpSteps, runId) {
      let state = base;
      let progression = createChroniclesProgression();
      let damageXp = 0;
      const byHero = {};
      for (const [index, hp] of hpSteps.entries()) {
        const next = { ...state, [goblin.hpKey]: hp };
        const actorMemberId = heroes[index % heroes.length].id;
        const params = { actorMemberId, actionKind: 'attack', runId };
        const result = applyChroniclesTacticsProgression(progression, state, next, params);
        const earned = result.awards.filter((award) => award.reason === 'daño útil')
          .reduce((sum, award) => sum + award.xp, 0);
        damageXp += earned;
        byHero[actorMemberId] = (byHero[actorMemberId] || 0) + earned;
        // A retry of any one-HP hit must never create another XP claim.
        expect(applyChroniclesTacticsProgression(result.progression, state, next, params).awards).toEqual([]);
        progression = result.progression;
        state = next;
      }
      return { damageXp, byHero, progression };
    }

    const single = play([0], 'damage-budget-single');
    const split = play([7, 6, 5, 4, 3, 2, 1, 0], 'damage-budget-split');
    expect(single.damageXp).toBe(2);
    expect(split.damageXp).toBe(2);
    expect(split.byHero).toEqual({ matthias: 1, rook: 0, bishop: 1, knight: 0 });
    const companyXp = (progression) => heroes.reduce(
      (sum, hero) => sum + chroniclesHeroProgress(progression, hero.id).xp, 0,
    );
    expect(companyXp(split.progression)).toBe(companyXp(single.progression));
  });

  it('pays exactly 18 kill XP for all nine sewer goblins, in real progression across three packs', () => {
    const map = chroniclesMapById(MAP_ID);
    const goblins = map.enemies.filter((enemy) => enemy.squadId);
    expect(goblins).toHaveLength(9);
    expect(goblins.every((goblin) => goblin.maxHp === 8 && goblin.damageXpHpCap === 4)).toBe(true);
    expect(new Set(goblins.map((enemy) => enemy.squadId)).size).toBe(3);

    let previous = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    let progression = createChroniclesProgression();
    const killAwards = [];
    const damageAwards = [];
    for (const enemy of goblins) {
      expect(previous[enemy.hpKey]).toBeGreaterThan(0);
      const defeated = { ...previous, [enemy.hpKey]: 0 };
      const params = { actorMemberId: 'matthias', actionKind: 'attack', runId: 'sewer-balance-benchmark' };
      const rewarded = applyChroniclesTacticsProgression(progression, previous, defeated, params);
      const kill = rewarded.awards.filter(({ reason }) => reason === 'baja');
      const damage = rewarded.awards.filter(({ reason }) => reason === 'daño útil');
      expect(kill.reduce((sum, award) => sum + award.xp, 0), enemy.id).toBe(2);
      killAwards.push(...kill);
      damageAwards.push(...damage);

      // Retrying a request or rehydrating a saved enemy may never multiply its bounty.
      const replay = applyChroniclesTacticsProgression(rewarded.progression, previous, defeated, params);
      expect(replay.awards).toEqual([]);
      progression = rewarded.progression;
      previous = defeated;
    }
    expect(killAwards.reduce((sum, award) => sum + award.xp, 0)).toBe(18);
    expect(damageAwards.reduce((sum, award) => sum + award.xp, 0)).toBe(18);
    const total = heroes.reduce((sum, hero) => sum + chroniclesHeroProgress(progression, hero.id).xp, 0);
    expect(total).toBe(36);
    expect(heroes.every((hero) => chroniclesHeroProgress(progression, hero.id).level === 1)).toBe(true);
  });
});
