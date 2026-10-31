import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';
import { chroniclesAutomapCheckpointFlags, chroniclesCheckpointAutomapVisited } from './chroniclesAutomapCheckpoint.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesRunCheckpointFingerprint,
  chroniclesRunCheckpointPayload,
} from './chroniclesRunCheckpoint.js';

describe('remote automap checkpoint', () => {
  it('restores learned geometry across two maps from the saved JSON without session storage', () => {
    const automapVisitedByMap = {
      'crypt-eight-squares': ['1:1', '2:1:s'],
      'gallery-of-forks': ['3:3', '4:3:s'],
    };
    const state = { ...createChroniclesState('gallery-of-forks'), automapVisitedByMap };
    const savedRun = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 4)));
    const freshSession = chroniclesApplyRunCheckpoint(createChroniclesState('gallery-of-forks'), savedRun);
    expect(freshSession.automapVisitedByMap).toEqual(automapVisitedByMap);
  });

  it('does not skip a manual save when only learned map geometry changed', () => {
    const state = createChroniclesState('gallery-of-forks');
    const previous = { ...state, automapVisitedByMap: { 'gallery-of-forks': ['1:1'] } };
    const explored = { ...state, automapVisitedByMap: { 'gallery-of-forks': ['1:1', '2:1'] } };
    expect(chroniclesRunCheckpointFingerprint(previous)).not.toBe(chroniclesRunCheckpointFingerprint(explored));
  });

  it('keeps all current areas and progression inside the existing Go checkpoint budgets', () => {
    const automapVisitedByMap = Object.fromEntries(chroniclesMapIds().map((id) => {
      const map = chroniclesMapById(id);
      const cells = map.grid.flatMap((row, y) => Array.from(row).flatMap((_, x) => [`${x}:${y}`, `${x}:${y}:s`]));
      return [id, cells];
    }));
    const payload = chroniclesRunCheckpointPayload({
      ...createChroniclesState('gallery-of-forks'),
      runProgression: createChroniclesProgression(),
      automapVisitedByMap,
    }, 1);
    expect(chroniclesCheckpointAutomapVisited(payload)).toEqual(automapVisitedByMap);
    expect(Object.keys(payload.worldFlags).length).toBeLessThanOrEqual(1024);
    expect(new TextEncoder().encode(JSON.stringify(payload.worldFlags)).length).toBeLessThanOrEqual(131072);
    for (const [key, value] of Object.entries(payload.worldFlags)) {
      expect(Array.from(key).length).toBeLessThanOrEqual(96);
      if (typeof value === 'string') expect(Array.from(value).length).toBeLessThanOrEqual(256);
    }
  });

  it('ignores unknown maps, malformed and out-of-bounds cells without revealing their neighbors', () => {
    const input = {
      'gallery-of-forks': ['1:1', '1:1', '1:1:s', '-1:1', '999:999', '1.5:1', 'x', null],
      'unknown-map': ['1:1'],
    };
    const before = JSON.stringify(input);
    const restored = chroniclesCheckpointAutomapVisited({ worldFlags: chroniclesAutomapCheckpointFlags(input) });
    expect(restored).toEqual({ 'gallery-of-forks': ['1:1', '1:1:s'] });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('has a stable save fingerprint regardless of reveal order or duplicate cells', () => {
    const state = createChroniclesState('gallery-of-forks');
    const first = { 'gallery-of-forks': ['2:1:s', '1:1'], 'crypt-eight-squares': ['1:1'] };
    const reordered = { 'crypt-eight-squares': ['1:1'], 'gallery-of-forks': ['1:1', '2:1:s', '1:1'] };
    expect(chroniclesRunCheckpointFingerprint({ ...state, automapVisitedByMap: first }))
      .toBe(chroniclesRunCheckpointFingerprint({ ...state, automapVisitedByMap: reordered }));
  });

  it('distinguishes legacy saves from a durable empty ledger or a damaged snapshot', () => {
    const legacy = { worldFlags: { '__chrRuntime.version': 1 } };
    expect(chroniclesCheckpointAutomapVisited(legacy)).toBeNull();
    expect(chroniclesApplyRunCheckpoint(createChroniclesState(), legacy)).not.toHaveProperty('automapVisitedByMap');
    const empty = { worldFlags: chroniclesAutomapCheckpointFlags({}) };
    expect(chroniclesCheckpointAutomapVisited(empty)).toEqual({});
    expect(chroniclesApplyRunCheckpoint(createChroniclesState(), empty).automapVisitedByMap).toEqual({});
    for (const flags of [
      { '__chrRuntime.automap.parts': 97 },
      { '__chrRuntime.automap.parts': 1 },
      { '__chrRuntime.automap.parts': 1, '__chrRuntime.automap.part.0': 'x'.repeat(241) },
      { '__chrRuntime.automap.parts': 1, '__chrRuntime.automap.part.0': '[2,[]]' },
    ]) expect(chroniclesCheckpointAutomapVisited({ worldFlags: flags })).toEqual({});
  });

  it('does not reinterpret geometry after a map dimension change or malformed packed data', () => {
    const map = chroniclesMapById('gallery-of-forks');
    const save = (row) => ({ worldFlags: {
      '__chrRuntime.automap.parts': 1,
      '__chrRuntime.automap.part.0': JSON.stringify([1, [row]]),
    } });
    expect(chroniclesCheckpointAutomapVisited(save([map.id, map.grid[0].length + 1, map.grid.length, 'f']))).toEqual({});
    expect(chroniclesCheckpointAutomapVisited(save([map.id, map.grid[0].length, map.grid.length, '!']))).toEqual({});
  });
});
