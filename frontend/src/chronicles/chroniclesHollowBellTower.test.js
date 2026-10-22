import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesTacticsInteractions,
  chroniclesTacticsUse,
} from '../chroniclesOfMatthiasTactics.js';
import {
  chroniclesInventoryEntries,
  chroniclesQuestEntries,
} from './chroniclesContentRuntime.js';
import { chroniclesContentVisualStateById } from './chroniclesContentVisualState.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import {
  chroniclesMapById,
  chroniclesMapIds,
  chroniclesMapTransitionState,
} from './chroniclesMapCatalog.js';

describe('Chronicles Hollow Bell Tower', () => {
  it('registers an eighth authored map with two independent brake levers', () => {
    expect(chroniclesMapIds()).toContain('hollow-bell-tower');
    const tower = chroniclesMapById('hollow-bell-tower');

    expect(tower.version).toBe(2);
    expect(tower.grid).toHaveLength(11);
    expect(tower.grid[0]).toHaveLength(11);
    expect(tower.enemies.map((enemy) => enemy.id)).toEqual([
      'hollow-bell-keeper',
      'west-chain-hound',
      'east-bell-spider',
      'bell-archivist',
      'toll-wisp',
      'tower-lower-hound',
      'tower-mechanism-spider',
      'tower-south-bishop',
    ]);
    expect(tower.interactables.filter((entry) => entry.kind === 'lever').map((entry) => entry.id)).toEqual([
      'west-bell-brake',
      'east-bell-brake',
    ]);
    expect(tower.enemies.filter((enemy) => enemy.optional).map((enemy) => enemy.id)).toEqual([
      'bell-archivist',
      'toll-wisp',
      'tower-lower-hound',
      'tower-mechanism-spider',
      'tower-south-bishop',
    ]);
  });

  it('keeps both brake states independent before releasing the master clapper', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'hollow-bell-tower');
    state = chroniclesTacticsUse(state, 'tower-inscription');

    state = {
      ...state,
      westChainHoundHp: 0,
      x: 1,
      y: 5,
    };
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'west-bell-brake',
      label: 'Accionar freno oeste',
    }));
    expect(chroniclesTacticsInteractions(state).map((entry) => entry.id)).not.toContain('east-bell-brake');

    state = chroniclesTacticsUse(state, 'west-bell-brake');
    expect(state.westBrakeSet).toBe(true);
    expect(state.eastBrakeSet).toBe(false);
    expect(chroniclesContentVisualStateById(state, 'west-bell-brake')).toMatchObject({
      activated: true,
      visible: true,
    });
    expect(chroniclesContentVisualStateById(state, 'east-bell-brake')).toMatchObject({
      activated: false,
      visible: true,
    });

    state = {
      ...state,
      eastBellSpiderHp: 0,
      x: 9,
      y: 5,
    };
    state = chroniclesTacticsUse(state, 'east-bell-brake');
    expect(state.westBrakeSet).toBe(true);
    expect(state.eastBrakeSet).toBe(true);
    expect(chroniclesContentVisualStateById(state, 'east-bell-brake')?.activated).toBe(true);

    state = {
      ...state,
      hollowBellKeeperHp: 0,
      x: 5,
      y: 5,
    };
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'master-clapper',
      label: 'Recuperar Badajo Maestro',
    }));
    state = chroniclesTacticsUse(state, 'master-clapper');

    expect(state.masterClapperClaimed).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'master-clapper',
      name: 'Badajo Maestro',
      quantity: 1,
    }));
    expect(chroniclesQuestEntries(state).find((quest) => quest.id === 'silence-hollow-bells')).toMatchObject({
      status: 'active',
      objective: 'Lleva el Badajo Maestro hasta la compuerta superior.',
    });

    // Extra patrols must not gate the Badajo or the exit: the original
    // two brakes + Campanero remain the only mandatory encounters.
    for (const key of ['towerLowerHoundHp', 'towerMechanismSpiderHp', 'towerSouthBishopHp']) {
      expect(state[key], key).toBeGreaterThan(0);
    }
    state = { ...state, x: 8, y: 1 };
    const cistern = chroniclesTacticsUse(state, 'tower-upper-gate');

    expect(cistern.mapId).toBe('echo-cistern');
    expect(cistern.phase).toBe('explore');
    expect({ x: cistern.x, y: cistern.y, direction: cistern.direction }).toEqual({ x: 1, y: 1, direction: 1 });
    expect(cistern.bellArchivistHp).toBe(0);
    expect(cistern.tollWispHp).toBe(0);
    expect(cistern.cisternWardenHp).toBe(12);
    expect(cistern.westSiltHoundHp).toBe(7);
    expect(cistern.eastDrainSpiderHp).toBe(6);
    expect(cistern.echoBishopHp).toBe(8);
    expect(cistern.brineWispHp).toBe(5);
    expect(chroniclesInventoryEntries(cistern).map((item) => item.id)).not.toContain('master-clapper');
    expect(chroniclesQuestEntries(cistern).find((quest) => quest.id === 'silence-hollow-bells')).toMatchObject({
      status: 'completed',
      objective: 'Torre superada.',
    });
    expect(cistern.journal.at(-1)?.id).toBe('hollow-bell-tower-cleared');
  });

  it('keeps the archivist cache optional and separate from the two-brake objective', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'hollow-bell-tower');
    state = {
      ...state,
      bellArchivistHp: 0,
      x: 7,
      y: 7,
    };

    state = chroniclesTacticsUse(state, 'bellwright-cache');

    expect(state.bellwrightCacheOpened).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'bellwright-oil',
      name: 'Aceite de Campanero',
      quantity: 1,
    }));
    expect(state.westBrakeSet).toBe(false);
    expect(state.eastBrakeSet).toBe(false);
    expect(state.masterClapperClaimed).toBe(false);
  });

  it('places three optional ordinary foes in reachable empty passages without duplicating rewards', () => {
    const tower = chroniclesMapById('hollow-bell-tower');
    const extra = tower.enemies.slice(5);
    expect(extra.map((enemy) => enemy.id)).toEqual([
      'tower-lower-hound', 'tower-mechanism-spider', 'tower-south-bishop',
    ]);
    expect(new Set(tower.enemies.map((enemy) => enemy.id)).size).toBe(8);
    expect(new Set(tower.enemies.map((enemy) => enemy.hpKey)).size).toBe(8);
    const reserved = new Set([tower.partyStart, ...tower.enemies.slice(0, 5),
      ...['interactables', 'treasures', 'traps', 'triggers', 'exits']
        .flatMap((kind) => tower[kind] || [])]
      .filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y))
      .map((entry) => `${entry.x},${entry.y}`));
    const reached = new Set([`${tower.partyStart.x},${tower.partyStart.y}`]);
    const queue = [tower.partyStart];
    for (const { x, y } of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = x + dx;
        const nextY = y + dy;
        const key = `${nextX},${nextY}`;
        if (!reached.has(key) && tower.grid[nextY]?.[nextX] && tower.grid[nextY][nextX] !== '#') {
          reached.add(key);
          queue.push({ x: nextX, y: nextY });
        }
      }
    }
    const originalById = new Map(tower.enemies.slice(0, 5).map((enemy) => [enemy.id, enemy]));
    for (const [i, enemy] of extra.entries()) {
      const cell = `${enemy.x},${enemy.y}`;
      expect(tower.grid[enemy.y][enemy.x], enemy.id).toBe('.');
      expect(reached.has(cell), enemy.id).toBe(true);
      expect(reserved.has(cell), enemy.id).toBe(false);
      expect(Math.abs(enemy.x - tower.partyStart.x) + Math.abs(enemy.y - tower.partyStart.y))
        .toBeGreaterThanOrEqual(5);
      expect(enemy.optional).toBe(true);
      expect(enemy.activation).toBe('always');
      expect(enemy.onDefeat?.effects || []).toEqual([]);
      expect(enemy.defeatedFlag).toBeUndefined();
      expect(enemy.ai).toEqual(originalById.get(
        ['west-chain-hound', 'east-bell-spider', 'bell-archivist'][i],
      ).ai);
      reserved.add(cell);
    }
  });

  it('keeps each new foe dead across area travel and checkpoint recovery', () => {
    const tower = chroniclesMapById('hollow-bell-tower');
    const original = tower.enemies.slice(0, 5);
    const additional = tower.enemies.slice(5);
    for (const foe of additional) {
      const entered = chroniclesMapTransitionState(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        'hollow-bell-tower',
      );
      expect(entered[foe.hpKey], foe.id).toBeGreaterThan(0);
      const fallen = { ...entered, [foe.hpKey]: 0 };
      const away = chroniclesMapTransitionState(fallen, 'swordhaven-first-book');
      const returned = chroniclesMapTransitionState(away, 'hollow-bell-tower');
      expect(returned[foe.hpKey], foe.id).toBe(0);
      expect(returned[original[0].hpKey]).toBeGreaterThan(0);
      const checkpoint = chroniclesRunCheckpointPayload(away, 1);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        { ...checkpoint, worldVersion: 1 },
      );
      const afterLoad = chroniclesMapTransitionState(restored, 'hollow-bell-tower');
      expect(afterLoad[foe.hpKey], foe.id).toBe(0);
      expect(afterLoad[original[0].hpKey]).toBeGreaterThan(0);
    }
  });
});
