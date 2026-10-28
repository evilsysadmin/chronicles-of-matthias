import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEngagedEnemies, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesMM3AttackHits, chroniclesMM3EnemyArmorClass } from './chroniclesMM3Rules.js';
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
        expect(member.maxHp).toBe(8);
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

  it('toughens every sewer foe without increasing attack damage or ordinary kill XP', () => {
    const map = chroniclesMapById(MAP_ID);
    const state = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const expectedHp = {
      'ash-goblin': 8, 'crypt-spider': 8, 'bone-hound': 10,
      'road-bandit': 13,
    };
    for (const enemy of map.enemies) {
      const expected = enemy.id === 'sewers-goblin-sluice' ? 12 : expectedHp[enemy.visualType];
      expect(enemy.maxHp, enemy.id).toBe(expected);
      expect(state[enemy.hpKey], enemy.id).toBe(expected);
      expect(enemy.ai.attackReach, enemy.id).toBe(1);
      const ac = enemy.id === 'sewers-goblin-sluice' ? 5 : ({
        'ash-goblin': 3, 'crypt-spider': 4, 'bone-hound': 5, 'road-bandit': 4,
      })[enemy.visualType];
      expect(enemy.armorClass, enemy.id).toBe(ac);
      expect(chroniclesMM3EnemyArmorClass(enemy), enemy.id).toBe(ac);
      // Each creature's actual AC must enter the same d20 hit rule that
      // melee and missile attacks already share, not be decorative metadata.
      expect(chroniclesMM3AttackHits(10 + ac - 1, 0, chroniclesMM3EnemyArmorClass(enemy))).toBe(false);
      expect(chroniclesMM3AttackHits(10 + ac, 0, chroniclesMM3EnemyArmorClass(enemy))).toBe(true);
      expect(enemy.ai.engagedMovement, enemy.id).toBe('cardinal-chase');
      // Endurance is the only balancing lever in this cut: no inflated burst
      // damage and no extra level/XP rewards from these low-level mobs.
      if (enemy.visualType === 'ash-goblin' && enemy.id !== 'sewers-goblin-sluice') {
        expect(enemy.retaliation, enemy.id).toBe(1);
        expect(enemy.killXp, enemy.id).toBe(2);
      }
    }
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

  it('alerts a screened packmate only when an attack-ready mate can reach it by sight', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    // At (1,4) the squad is visible but nobody can strike yet; (1,5)
    // puts its first goblin in melee range and legitimately starts combat.
    const state = { ...base, x: 1, y: 5 };
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
    const killAwards = result.awards.filter((award) => award.reason === 'baja');
    expect(killAwards).toHaveLength(2);
    expect(killAwards.map((award) => award.xp)).toEqual([1, 1]);
    expect(killAwards.reduce((total, award) => total + award.xp, 0))
      .toBe(chroniclesKillXp(goblin));
    expect(result.awards.filter((award) => award.reason === 'daño útil').length).toBeGreaterThan(0);
    const replay = applyChroniclesTacticsProgression(result.progression, before, after, params);
    expect(replay.awards).toEqual([]);

    const reentered = chroniclesMapTransitionState(
      chroniclesMapTransitionState({ ...after }, 'swordhaven-first-book'), MAP_ID);
    expect(reentered[goblin.hpKey]).toBe(0);
  });

  it('makes screened squadmates spend an action approaching, never attack through their frontline', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const atEntrance = { ...base, x: 1, y: 5 };
    const enemies = chroniclesActiveEnemies(atEntrance);
    const west = enemies.find((enemy) => enemy.id === 'sewers-goblin-west');
    const overflow = enemies.find((enemy) => enemy.id === 'sewers-goblin-overflow');
    const combat = chroniclesStartInitiativeCombat(atEntrance, enemies, { random: () => 0 });
    expect(inCombat(combat)).toContain(overflow.id);
    const enemyTurn = { ...combat, turnPhase: 'enemy' };
    const hpBefore = enemyTurn.party.map((member) => member.hp);

    // The frontline goblin occupies (2,5). Its mate at (3,5) can now
    // enter the southern drain, but cannot teleport or attack in the same turn.
    const blocked = chroniclesResolveEnemyActor(enemyTurn, overflow.id);
    expect(blocked.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(blocked.party.map((member) => member.hp)).toEqual(hpBefore);
    expect(chroniclesRuntimeEnemyPosition(blocked, overflow)).toEqual({ x: 3, y: 6 });

    // After the frontline falls, the next action moves one cardinal tile;
    // reaching melee range does not also grant a free attack.
    const cleared = { ...enemyTurn, [west.hpKey]: 0 };
    const approached = chroniclesResolveEnemyActor(cleared, overflow.id);
    expect(approached.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(approached, overflow)).toEqual({ x: 2, y: 5 });
    expect(approached.party.map((member) => member.hp)).toEqual(hpBefore);
  });

  it('lets the rear goblin take a real detour without passing through companions or earning free hits', () => {
    const base = createChroniclesState(MAP_ID, null, { rules: 'mm3' });
    const atEntrance = { ...base, x: 1, y: 5 };
    const enemies = chroniclesActiveEnemies(atEntrance);
    const west = enemies.find((enemy) => enemy.id === 'sewers-goblin-west');
    const middle = enemies.find((enemy) => enemy.id === 'sewers-goblin-overflow');
    const rear = enemies.find((enemy) => enemy.id === 'sewers-goblin-bottom-shaft');
    const combat = chroniclesStartInitiativeCombat(atEntrance, enemies, { random: () => 0 });
    expect(inCombat(combat)).toEqual(expect.arrayContaining([middle.id, rear.id]));

    // After the front goblin falls, the middle takes its cell. The rear
    // must use a legal adjacent step rather than crossing the middle goblin.
    const cleared = { ...combat, turnPhase: 'enemy', [west.hpKey]: 0 };
    const hpBefore = cleared.party.map((member) => member.hp);
    const middleTurn = chroniclesResolveEnemyActor(cleared, middle.id);
    expect(middleTurn.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    expect(chroniclesRuntimeEnemyPosition(middleTurn, middle)).toEqual({ x: 2, y: 5 });
    expect(middleTurn.party.map((member) => member.hp)).toEqual(hpBefore);

    const rearTurn = chroniclesResolveEnemyActor(middleTurn, rear.id);
    expect(rearTurn.enemyTurnEvents.map((event) => event.type)).toEqual(['move']);
    const initialRear = chroniclesRuntimeEnemyPosition(middleTurn, rear);
    const detour = chroniclesRuntimeEnemyPosition(rearTurn, rear);
    expect(Math.abs(detour.x - initialRear.x) + Math.abs(detour.y - initialRear.y)).toBe(1);
    expect(detour).not.toEqual({ x: 2, y: 5 });
    expect(rearTurn.party.map((member) => member.hp)).toEqual(hpBefore);

    // Removing the middle goblin reopens the direct route. Every subsequent
    // move costs an entire action; a hit is possible only on a later turn.
    let state = { ...rearTurn, [middle.hpKey]: 0 };
    let moves = 0;
    let attacked = false;
    for (let turn = 0; turn < 8; turn += 1) {
      const from = chroniclesRuntimeEnemyPosition(state, rear);
      const next = chroniclesResolveEnemyActor(state, rear.id);
      const types = next.enemyTurnEvents.map((event) => event.type);
      if (types[0] === 'attack') {
        expect(types).toEqual(['attack']);
        // The detour before the middle fell already consumed one move.
        expect(moves + 1).toBeGreaterThanOrEqual(2);
        expect(chroniclesRuntimeEnemyPosition(next, rear)).toEqual(from);
        attacked = true;
        break;
      }
      expect(types).toEqual(['move']);
      const to = chroniclesRuntimeEnemyPosition(next, rear);
      expect(Math.abs(to.x - from.x) + Math.abs(to.y - from.y)).toBe(1);
      expect(next.party.map((member) => member.hp)).toEqual(hpBefore);
      state = next;
      moves += 1;
    }
    expect(attacked).toBe(true);
  });

});
