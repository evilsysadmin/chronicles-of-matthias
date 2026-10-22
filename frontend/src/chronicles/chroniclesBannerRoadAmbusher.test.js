import { describe, expect, it } from 'vitest';
import { chroniclesPartyAttackStats, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

describe('Chronicles · optional banner road ambusher', () => {
  it('spawns as a real, optional enemy on walkable terrain', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const enemy = map.enemies.find((entry) => entry.id === 'banner-road-deserter');
    // The authored file starts at 4 HP; the resolved enemyBuild has 5 effective HP.
    expect(enemy).toMatchObject({
      optional: true, visualType: 'road-bandit', hpKey: 'bannerRoadDeserterHp',
      maxHp: 5, x: 11, y: 5,
    });
    expect(map.grid[enemy.y][enemy.x]).not.toBe('#');
    expect(createChroniclesState('banner-road-first-book').bannerRoadDeserterHp).toBe(5);
  });

  it('allows first-person combat and grants exactly three gold only on the kill', () => {
    let state = createChroniclesState('banner-road-first-book');
    state = { ...state, x: 11, y: 6, direction: 0 };
    // Hildegard has enough HP to survive the retaliation; Matthias alone
    // can be knocked out before finishing this five-HP combat encounter.
    const damage = chroniclesPartyAttackStats(state, 'rook').damage;
    const blows = Math.ceil(state.bannerRoadDeserterHp / damage);
    expect(blows).toBeGreaterThan(1);
    for (let hit = 1; hit < blows; hit += 1) {
      state = chroniclesReduce(state, { type: 'attack', memberId: 'rook' });
      expect(state.bannerRoadDeserterHp).toBe(5 - hit * damage);
      expect(chroniclesGoldBalance(state)).toBe(0);
    }
    state = chroniclesReduce(state, { type: 'attack', memberId: 'rook' });
    expect(state.bannerRoadDeserterHp).toBe(0);
    expect(state.bannerRoadDeserterDefeated).toBe(true);
    expect(chroniclesGoldBalance(state)).toBe(3);
    expect(state.journal.filter((entry) => entry.id === 'banner-road-deserter-falls')).toHaveLength(1);
    const after = chroniclesReduce(state, { type: 'attack', memberId: 'rook' });
    expect(chroniclesGoldBalance(after)).toBe(3);
    expect(after.journal.filter((entry) => entry.id === 'banner-road-deserter-falls')).toHaveLength(1);

    const snapshot = chroniclesRunCheckpointPayload(after, 5);
    const recovered = chroniclesApplyRunCheckpoint(
      createChroniclesState('banner-road-first-book'),
      snapshot,
    );
    expect(recovered.bannerRoadDeserterHp).toBe(0);
    expect(recovered.bannerRoadDeserterDefeated).toBe(true);
    expect(chroniclesGoldBalance(recovered)).toBe(3);
    expect(chroniclesGoldBalance(chroniclesReduce(recovered, { type: 'attack', memberId: 'rook' }))).toBe(3);
  });

  it('places four stable optional patrols away from C3 entrances, objectives and original enemies', () => {
    const map = chroniclesMapById('banner-road-first-book');
    const originals = [
      'banner-road-deserter',
      'banner-road-bandit-captain',
      'banner-road-east-scout',
      'banner-road-north-marauder',
      'banner-road-west-deserter',
      'banner-road-crossroads-thug',
      'banner-road-east-rustler',
    ];
    const added = [
      ['banner-road-northwest-raider', 1, 2, 'banner-road-north-marauder'],
      ['banner-road-west-roadwatch', 5, 8, 'banner-road-west-deserter'],
      ['banner-road-far-east-crossbow', 19, 1, 'banner-road-east-scout'],
      ['banner-road-southeast-looter', 16, 13, 'banner-road-crossroads-thug'],
    ];
    expect(map.enemies.map((enemy) => enemy.id)).toEqual([
      ...originals, ...added.map(([id]) => id),
    ]);
    expect(new Set(map.enemies.map((enemy) => enemy.id)).size).toBe(11);
    expect(new Set(map.enemies.map((enemy) => enemy.hpKey)).size).toBe(11);
    const reserved = [map.partyStart, ...map.enemies.slice(0, originals.length),
      ...['triggers', 'interactables', 'treasures', 'traps', 'exits']
        .flatMap((group) => map[group] || []),
    ].filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y));
    const cells = new Set(reserved.map(({ x, y }) => `${x},${y}`));
    const reach = new Set([`${map.partyStart.x},${map.partyStart.y}`]);
    const queue = [map.partyStart];
    for (const { x, y } of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (map.grid[ny]?.[nx] && map.grid[ny][nx] !== '#' && !reach.has(key)) {
          reach.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const [id, x, y, template] of added) {
      const enemy = map.enemies.find((entry) => entry.id === id);
      const source = map.enemies.find((entry) => entry.id === template);
      expect(enemy, id).toMatchObject({
        x, y, optional: true, activation: 'always',
        visualType: source.visualType,
      });
      expect(enemy.ai, id).toEqual(source.ai);
      expect(enemy.enemyBuild.archetype, id).toBe(source.enemyBuild.archetype);
      expect(enemy.onDefeat?.effects || [], id).toEqual([]);
      expect(enemy.defeatedFlag, id).toBeUndefined();
      const key = `${x},${y}`;
      expect(map.grid[y][x], id).toBe('.');
      expect(reach.has(key), id).toBe(true);
      expect(cells.has(key), id).toBe(false);
      expect(distance(enemy, map.partyStart), id).toBeGreaterThanOrEqual(5);
      expect(map.exits.filter((gate) => Number.isInteger(gate.x) && Number.isInteger(gate.y))
        .every((gate) => distance(enemy, gate) >= 4), id).toBe(true);
      cells.add(key);
    }
    // Garrah and the first deserter alone retain their one-time story rewards.
    expect(map.enemies[0].defeatedFlag).toBe('bannerRoadDeserterDefeated');
    expect(map.enemies[1].defeatedFlag).toBe('bannerRoadCaptainDefeated');
    expect(map.enemies[1].onDefeat.effects.some((effect) => effect.itemId === 'tampered-route')).toBe(true);
  });

  it('remembers each new C3 patrol death after travel and checkpoint recovery', () => {
    const map = chroniclesMapById('banner-road-first-book');
    for (const foe of map.enemies.slice(7)) {
      const entered = chroniclesMapTransitionState(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        map.id,
      );
      expect(entered[foe.hpKey], foe.id).toBeGreaterThan(0);
      const departed = chroniclesMapTransitionState(
        { ...entered, [foe.hpKey]: 0 }, 'swordhaven-first-book',
      );
      const returned = chroniclesMapTransitionState(departed, map.id);
      expect(returned[foe.hpKey], foe.id).toBe(0);
      expect(returned.bannerRoadCaptainHp).toBeGreaterThan(0);
      const checkpoint = chroniclesRunCheckpointPayload(departed, 1);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        { ...checkpoint, worldVersion: 1 },
      );
      const loaded = chroniclesMapTransitionState(restored, map.id);
      expect(loaded[foe.hpKey], foe.id).toBe(0);
      expect(loaded.bannerRoadCaptainHp).toBeGreaterThan(0);
    }
  });
});
