import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsMove } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

describe('MM3 dungeon progression · Archive shelf plate', () => {
  it('adds a stronger but avoidable hazard without blocking the sealed index', () => {
    const map = chroniclesMapById('blind-king-archive');
    const trap = map.traps.find((entry) => entry.id === 'archive-shelf-plate');
    expect(trap).toMatchObject({
      x: 4, y: 5, kind: 'trap', visualType: 'chain-plate',
      when: [{ key: 'archiveShelfPlateSpent', equals: false }],
    });
    expect(trap.action.effects).toEqual([
      { type: 'set', key: 'archiveShelfPlateSpent', value: true },
      { type: 'damage-party', amount: 3 },
    ]);
    expect(map.grid[trap.y][trap.x]).toBe('.');
    const occupied = [...map.enemies, ...map.interactables, ...map.treasures]
      .some((entry) => entry.x === trap.x && entry.y === trap.y);
    expect(occupied).toBe(false);

    // A valid route to the quest lever remains even when the hazard is avoided.
    const key = ({ x, y }) => `${x},${y}`;
    const reached = new Set([key(map.partyStart)]);
    const queue = [map.partyStart];
    for (const point of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: point.x + dx, y: point.y + dy };
        const id = key(next);
        if (id === key(trap) || reached.has(id) || !map.grid[next.y]?.[next.x]
          || map.grid[next.y][next.x] === '#') continue;
        reached.add(id);
        queue.push(next);
      }
    }
    expect(reached.has('6,3')).toBe(true);
  });

  it('damages only on first entry and stays disarmed after travel and checkpoint recovery', () => {
    const arrived = chroniclesMapTransitionState(
      createChroniclesState('gallery-of-forks', null, { rules: 'mm3' }),
      'blind-king-archive',
    );
    const before = { ...arrived, x: 3, y: 5, phase: 'explore' };
    const triggered = chroniclesTacticsMove(before, { x: 4, y: 5 });
    expect(triggered.archiveShelfPlateSpent).toBe(true);
    expect(triggered.message).toMatch(/anaquel de hierro/i);
    expect(triggered.party.some((member, index) => member.hp < before.party[index].hp)).toBe(true);
    triggered.party.forEach((member, index) => {
      const damage = before.party[index].hp - member.hp;
      expect(damage).toBeGreaterThanOrEqual(0);
      expect(damage).toBeLessThanOrEqual(3);
    });

    const repeated = chroniclesTacticsMove({ ...triggered, x: 3, y: 5 }, { x: 4, y: 5 });
    expect(repeated.party).toEqual(triggered.party);

    const departed = chroniclesMapTransitionState(triggered, 'menagerie-of-ash');
    expect(departed).not.toHaveProperty('archiveShelfPlateSpent');
    const saved = chroniclesRunCheckpointPayload(departed, 3);
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }), saved,
    );
    const revisited = chroniclesMapTransitionState(restored, 'blind-king-archive');
    expect(revisited.archiveShelfPlateSpent).toBe(true);
    const retried = chroniclesTacticsMove(
      { ...revisited, x: 3, y: 5, phase: 'explore' }, { x: 4, y: 5 },
    );
    expect(retried.party).toEqual(revisited.party);
  });
});
