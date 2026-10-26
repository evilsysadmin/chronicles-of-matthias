import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEngagedEnemies, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import {
  applyChroniclesTacticsProgression,
  chroniclesKillXp,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';

const MAP_ID = 'swordhaven-sewers';
const PACKS = [
  { id: 'sewers-west-pack', entrance: { x: 1, y: 5 },
    goblins: ['sewers-goblin-west', 'sewers-goblin-overflow', 'sewers-goblin-bottom-shaft'] },
  { id: 'sewers-central-pack', entrance: { x: 7, y: 3 },
    goblins: ['sewers-goblin-mid', 'sewers-goblin-upper-gallery', 'sewers-goblin-east-culvert'] },
  { id: 'sewers-cistern-pack', entrance: { x: 18, y: 7 },
    goblins: ['sewers-goblin-cistern', 'sewers-goblin-east', 'sewers-goblin-drain'] },
];

function inCombat(state) {
  return (state.initiative?.order || []).filter((actor) => actor.kind === 'enemy')
    .map((actor) => actor.id);
}

describe('Chronicles · sewer goblins attack in low-XP packs', () => {
  it('keeps nine ordinary goblins in three navigable packs without new respawns', () => {
    const map = chroniclesMapById(MAP_ID);
    expect(map.enemies).toHaveLength(19);
    expect(map.enemies[0].id).toBe('sewers-goblin-west');
    const occupied = new Set();
    for (const enemy of map.enemies) {
      const cell = `${enemy.x},${enemy.y}`;
      expect(map.grid[enemy.y]?.[enemy.x], enemy.id).toBe('.');
      expect(occupied.has(cell), enemy.id).toBe(false);
      occupied.add(cell);
    }
    for (const pack of PACKS) {
      const members = map.enemies.filter((enemy) => enemy.squadId === pack.id);
      expect(members.map((enemy) => enemy.id).sort()).toEqual([...pack.goblins].sort());
      for (const member of members) {
        expect(member.maxHp).toBe(4);
        expect(member.retaliation).toBe(1);
        expect(member.ai.movement).toBe('hold');
        expect(member.ai.engagedMovement).toBe('cardinal-chase');
        expect(member.killXp).toBe(2);
        expect(Math.abs(member.x - pack.entrance.x) + Math.abs(member.y - pack.entrance.y))
          .toBeLessThanOrEqual(3);
      }
    }
    expect(map.enemies.find((enemy) => enemy.id === 'sewers-goblin-sluice').squadId).toBeUndefined();
  });

  it.each(PACKS)('$id joins one initiative with all three living goblins', (pack) => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const state = { ...base, ...pack.entrance };
    const enemies = chroniclesActiveEnemies(state);
    const combat = chroniclesStartInitiativeCombat(state, enemies, { random: () => 0 });
    expect(combat.phase).toBe('combat');
    expect(inCombat(combat).filter((id) => pack.goblins.includes(id)).sort())
      .toEqual([...pack.goblins].sort());
  });

  it('alerts a screened packmate only when an already-engaged mate can reach it by sight', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const state = { ...base, x: 1, y: 4 };
    const active = chroniclesActiveEnemies(state);
    const direct = chroniclesEngagedEnemies(state, active).filter((enemy) => enemy.squadId === PACKS[0].id);
    expect(direct.length).toBeGreaterThan(0);
    expect(direct.length).toBeLessThan(3);
    const combat = chroniclesStartInitiativeCombat(state, active, { random: () => 0 });
    expect(inCombat(combat).filter((id) => PACKS[0].goblins.includes(id)).sort())
      .toEqual([...PACKS[0].goblins].sort());

    // A distant living enemy with the same squadId is not teleported into combat.
    const separated = active.map((enemy) => enemy.id === 'sewers-goblin-overflow'
      ? { ...enemy, squadId: PACKS[0].id, x: 23, y: 17 }
      : enemy);
    const separatedCombat = chroniclesStartInitiativeCombat(state, separated, { random: () => 0 });
    expect(inCombat(separatedCombat)).not.toContain('sewers-goblin-overflow');
  });

  it('never recruits dead goblins, and Tactics remains independently engaged', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
    const state = { ...base, x: 1, y: 4, [goblin.hpKey]: 0 };
    const combat = chroniclesStartInitiativeCombat(state, chroniclesActiveEnemies(state), { random: () => 0 });
    expect(inCombat(combat)).not.toContain(goblin.id);

    const tactics = createChroniclesState(MAP_ID);
    const tacticsAtEntrance = { ...tactics, x: 1, y: 4 };
    const available = chroniclesActiveEnemies(tacticsAtEntrance);
    const direct = chroniclesEngagedEnemies(tacticsAtEntrance, available).map((enemy) => enemy.id).sort();
    const tacticsCombat = chroniclesStartInitiativeCombat(tacticsAtEntrance, available, { random: () => 0 });
    expect(inCombat(tacticsCombat).sort()).toEqual(direct);
  });

  it('cuts ordinary kill XP, keeps useful-damage XP finite, and deduplicates rewards', () => {
    const before = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const goblin = chroniclesActiveEnemies(before).find((enemy) => enemy.id === 'sewers-goblin-west');
    const hound = chroniclesActiveEnemies(before).find((enemy) => enemy.id === 'sewers-hound');
    expect(chroniclesKillXp(goblin)).toBe(2);
    expect(chroniclesKillXp(hound)).toBeGreaterThan(2);
    expect(chroniclesKillXp({ maxHp: 4, killXp: -4 })).toBe(9);

    const after = { ...before, [goblin.hpKey]: 0 };
    const params = { actorMemberId: 'matthias', actionKind: 'attack', runId: 'pack-expedition' };
    const result = applyChroniclesTacticsProgression(createChroniclesProgression(), before, after, params);
    expect(result.awards.filter((award) => award.reason === 'baja')).toHaveLength(4);
    expect(result.awards.filter((award) => award.reason === 'baja').map((award) => award.xp))
      .toEqual([1, 1, 1, 1]);
    expect(result.awards.filter((award) => award.reason === 'daño útil').length).toBeGreaterThan(0);
    const replay = applyChroniclesTacticsProgression(result.progression, before, after, params);
    expect(replay.awards).toEqual([]);

    const reentered = chroniclesMapTransitionState(
      chroniclesMapTransitionState({ ...after }, 'swordhaven-first-book'), MAP_ID);
    expect(reentered[goblin.hpKey]).toBe(0);
  });
});
