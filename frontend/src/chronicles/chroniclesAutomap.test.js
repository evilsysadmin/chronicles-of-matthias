import { beforeEach, describe, expect, it } from 'vitest';
import { clearStorageMemoryFallback } from '../safeStorage.js';
import {
  chroniclesAutomapCellKey,
  chroniclesAutomapFacingDegrees,
  chroniclesAutomapTouchedCells,
  chroniclesAutomapMarkVisited,
  chroniclesAutomapMarkSeen,
  chroniclesAutomapRevealedCells,
  clearChroniclesAutomapVisited,
  loadChroniclesAutomapVisited,
  saveChroniclesAutomapVisited,
} from './chroniclesAutomap.js';

describe('Chronicles automap', () => {
  const runId = 'automap-test-run';

  beforeEach(() => {
    clearStorageMemoryFallback();
    clearChroniclesAutomapVisited(runId);
  });
  it('tracks visited cells per map without mutating the previous ledger', () => {
    const empty = {};
    const first = chroniclesAutomapMarkVisited(empty, { mapId: 'crypt', x: 2, y: 3 });
    const duplicate = chroniclesAutomapMarkVisited(first, { mapId: 'crypt', x: 2, y: 3 });
    const secondMap = chroniclesAutomapMarkVisited(first, { mapId: 'gallery', x: 1, y: 1 });

    expect(empty).toEqual({});
    expect(first).toEqual({ crypt: ['2:3'] });
    expect(duplicate).toBe(first);
    expect(secondMap).toEqual({ crypt: ['2:3'], gallery: ['1:1'] });
  });

  it('reveals only geometry explicitly seen or walked, not adjacent tiles', () => {
    const map = {
      grid: [
        '#####',
        '#...#',
        '#...#',
        '#####',
      ],
    };
    const revealed = chroniclesAutomapRevealedCells(map, [chroniclesAutomapCellKey(2, 1)]);

    expect([...revealed].sort()).toEqual(['2:1']);
    expect(revealed.has('0:0')).toBe(false);
  });

  it('survives reload through safe session storage without touching the run checkpoint', () => {
    const visited = {
      crypt: ['1:1', '1:2', '1:2'],
      gallery: ['3:4'],
    };

    expect(saveChroniclesAutomapVisited(runId, visited)).toBeTypeOf('boolean');
    expect(loadChroniclesAutomapVisited(runId)).toEqual({
      crypt: ['1:1', '1:2'],
      gallery: ['3:4'],
    });

    clearChroniclesAutomapVisited(runId);
    expect(loadChroniclesAutomapVisited(runId)).toEqual({});
  });

  it('maps the canonical N/E/S/O direction index to arrow rotation', () => {
    expect([0, 1, 2, 3].map(chroniclesAutomapFacingDegrees)).toEqual([0, 90, 180, 270]);
    expect(chroniclesAutomapFacingDegrees(4)).toBe(0);
    expect(chroniclesAutomapFacingDegrees(-1)).toBe(270);
  });
});

describe('Chronicles automap learns only what the company touches (MM3)', () => {
  const map = { grid: ['#######', '#.....#', '#.###.#', '#.....#', '#######'] };

  it('records the tile underfoot and the walls around it, nothing ahead', () => {
    const state = { mapId: 'm', x: 1, y: 1, direction: 1 };
    const seen = chroniclesAutomapMarkSeen({}, map, state);
    expect(seen.m).toContain('1:1');
    expect(seen.m).toEqual(expect.arrayContaining(['0:0:s', '1:0:s', '2:0:s', '0:1:s', '0:2:s', '2:2:s']));
    // Open floor next to the company stays unknown, however it faces.
    for (const key of ['2:1', '3:1', '1:2', '1:3']) {
      expect(seen.m).not.toContain(key);
      expect(seen.m).not.toContain(`${key}:s`);
    }
    expect(chroniclesAutomapMarkSeen(seen, map, { ...state, direction: 2 })).toBe(seen);
  });

  it('grows the map one step at a time', () => {
    const first = chroniclesAutomapMarkSeen({}, map, { mapId: 'm', x: 1, y: 1, direction: 1 });
    const second = chroniclesAutomapMarkSeen(first, map, { mapId: 'm', x: 2, y: 1, direction: 1 });
    expect(second.m).toContain('2:1');
    expect(second.m).toContain('3:2:s');
    expect(second.m).not.toContain('3:1');
    const revealed = chroniclesAutomapRevealedCells(map, second.m);
    expect(revealed.has('3:1')).toBe(false);
  });

  it('touches nothing outside the grid', () => {
    expect(chroniclesAutomapTouchedCells(map, { x: 0, y: 0 }).has('-1:-1')).toBe(false);
    expect(chroniclesAutomapTouchedCells(map, { x: 99, y: 0 }).size).toBe(0);
  });
});

describe('Chronicles map coordinates, MM3 style', () => {
  it('counts X east and Y north from the south-west corner', async () => {
    const { chroniclesMapCoordinates, chroniclesMapCoordinatesLabel } = await import('./chroniclesAutomap.js');
    const map = { grid: ['#####', '#...#', '#...#', '#####'] };
    expect(chroniclesMapCoordinates(map, { x: 1, y: 2 })).toEqual({ x: 1, y: 1 });
    expect(chroniclesMapCoordinatesLabel(map, { x: 3, y: 1 })).toBe('X3 Y2');
    expect(chroniclesMapCoordinatesLabel(map, {})).toBe('');
  });
});
