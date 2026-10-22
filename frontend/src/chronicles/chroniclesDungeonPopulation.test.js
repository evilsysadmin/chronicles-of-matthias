import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const SECTORS = [
  { id: 'swordhaven-sewers', minimum: 19, original: 10, added: 9 },
  { id: 'blind-king-archive', minimum: 8, original: 5, added: 3 },
  { id: 'iron-foundry', minimum: 8, original: 5, added: 3 },
  { id: 'templo-corona-cripta', minimum: 8, original: 5, added: 3 },
];

function reachableCells(map) {
  const start = map.partyStart;
  const found = new Set([start.x + ',' + start.y]);
  const queue = [start];
  for (const point of queue) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = x + ',' + y;
      if (map.grid[y]?.[x] === '#' || !map.grid[y]?.[x] || found.has(key)) continue;
      found.add(key);
      queue.push({ x, y });
    }
  }
  return found;
}

describe('Chronicles MM3 · populated dungeon corridors', () => {
  it.each(SECTORS)('$id: enemies are spread through accessible, reserved-free map cells', ({ id, minimum, original, added }) => {
    const map = chroniclesMapById(id);
    const extra = map.enemies.slice(original);
    expect(map.enemies).toHaveLength(minimum);
    expect(extra).toHaveLength(added);
    const reachable = reachableCells(map);
    const reserved = [
      map.partyStart,
      ...map.enemies.slice(0, original),
      ...['triggers', 'interactables', 'treasures', 'traps', 'exits']
        .flatMap((group) => map[group] || []),
    ].filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y));
    const occupied = new Set(reserved.map((entry) => entry.x + ',' + entry.y));
    const originalHpKeys = new Set(map.enemies.slice(0, original).map((enemy) => enemy.hpKey));
    for (const enemy of extra) {
      const key = enemy.x + ',' + enemy.y;
      expect(reachable.has(key), id + '/' + enemy.id + ' must be reachable').toBe(true);
      expect(occupied.has(key), id + '/' + enemy.id + ' must not overlap another encounter or POI').toBe(false);
      expect(enemy.optional, enemy.id).toBe(true);
      expect(enemy.activation, enemy.id).toBe('always');
      // A copied archetype must never drag its old coordinate-bound patrol.
      if (enemy.ai.movement === 'patrol-route') {
        expect(enemy.ai.patrolRoute?.some((point) => point.x === enemy.x && point.y === enemy.y), enemy.id).toBe(true);
      }
      expect(originalHpKeys.has(enemy.hpKey), enemy.id).toBe(false);
      expect(enemy.onDefeat?.effects?.some((effect) =>
        ['advance-quest', 'complete-quest', 'grant-item', 'set'].includes(effect.type)), enemy.id).toBeFalsy();
      // Starting a campaign should leave space before first contact.
      expect(Math.abs(enemy.x - map.partyStart.x) + Math.abs(enemy.y - map.partyStart.y)).toBeGreaterThanOrEqual(5);
      occupied.add(key);
    }
    expect(new Set(map.enemies.map((enemy) => enemy.id)).size).toBe(map.enemies.length);
    expect(new Set(map.enemies.map((enemy) => enemy.hpKey)).size).toBe(map.enemies.length);
    // Appended enemies preserve stable slainEnemies indices for old saves.
    expect(map.enemies[0].id).toBe({
      'swordhaven-sewers': 'sewers-goblin-west',
      'blind-king-archive': 'ledger-warden',
      'iron-foundry': 'iron-sentinel',
      'templo-corona-cripta': 'templo-corona-cripta-spider',
    }[id]);
  });

  it.each(SECTORS)('$id: reinforcement deaths persist across map travel and saved checkpoints', ({ id, original }) => {
    const map = chroniclesMapById(id);
    const firstNewEnemy = map.enemies[original];
    const fresh = chroniclesMapTransitionState(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), id);
    expect(fresh[firstNewEnemy.hpKey], firstNewEnemy.id).toBeGreaterThan(0);
    const killed = { ...fresh, [firstNewEnemy.hpKey]: 0 };
    const departed = chroniclesMapTransitionState(killed, 'swordhaven-first-book');
    const returned = chroniclesMapTransitionState(departed, id);
    expect(returned[firstNewEnemy.hpKey]).toBe(0);
    expect(returned[map.enemies[0].hpKey]).toBeGreaterThan(0);
    const payload = chroniclesRunCheckpointPayload(departed, 1);
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      { ...payload, worldVersion: 1 },
    );
    const returnedAfterLoad = chroniclesMapTransitionState(restored, id);
    expect(returnedAfterLoad[firstNewEnemy.hpKey]).toBe(0);
    expect(returnedAfterLoad[map.enemies[0].hpKey]).toBeGreaterThan(0);
  });
});
