import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import {
  chroniclesApplyContentEffects,
  chroniclesInventoryEntries,
  chroniclesQuestEntries,
} from './chroniclesContentRuntime.js';
import {
  chroniclesMapById,
  chroniclesMapIds,
  chroniclesMapTransitionState,
} from './chroniclesMapCatalog.js';

describe('Chronicles Chain Basilica', () => {
  it('registers a seventh authored map with a three-link objective and optional wisp', () => {
    expect(chroniclesMapIds()).toContain('chain-basilica');
    const basilica = chroniclesMapById('chain-basilica');

    expect(basilica.version).toBe(5);
    expect(basilica.grid).toHaveLength(9);
    expect(basilica.grid[0]).toHaveLength(13);
    expect(basilica.enemies.map((enemy) => enemy.id)).toEqual([
      'iron-deacon',
      'chain-prelate',
      'choir-hound',
      'nave-spider',
      'censer-wisp',
      'basilica-north-hound',
      'basilica-floor-spider',
      'basilica-south-specter',
    ]);
    expect(basilica.enemies.filter((enemy) => enemy.optional).map((enemy) => enemy.id)).toEqual([
      'censer-wisp',
      'basilica-north-hound',
      'basilica-floor-spider',
      'basilica-south-specter',
    ]);
    // Only the original three sworn guardians may award altar keys.
    expect(basilica.enemies.filter((enemy) => enemy.onDefeat?.effects?.some((effect) =>
      effect.type === 'grant-item' && effect.itemId === 'liturgical-link',
    )).map((enemy) => enemy.id)).toEqual(['iron-deacon', 'choir-hound', 'nave-spider']);
    expect(basilica.treasures.map((entry) => entry.id)).toEqual(['chain-altar', 'oculus-cache']);
    expect(basilica.interactables.find((entry) => entry.id === 'black-glass-secret-door')).toMatchObject({
      kind: 'secret-door',
      proceduralModule: 'black-glass-route',
    });
  });

  it('stacks three liturgical links, consumes all three at the altar and keeps the wisp optional', () => {
    const basilica = chroniclesMapById('chain-basilica');
    let state = chroniclesMapTransitionState(createChroniclesState(), basilica.id);
    state = chroniclesTacticsUse(state, 'basilica-inscription');

    for (const enemyId of ['iron-deacon', 'choir-hound', 'nave-spider']) {
      const enemy = basilica.enemies.find((candidate) => candidate.id === enemyId);
      state = {
        ...chroniclesApplyContentEffects(state, enemy.onDefeat.effects),
        [enemy.hpKey]: 0,
      };
    }

    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'liturgical-link',
      name: 'Eslabón Litúrgico',
      quantity: 3,
    }));

    state = {
      ...state,
      chainPrelateHp: 0,
      x: 9,
      y: 5,
    };
    state = chroniclesTacticsUse(state, 'chain-altar');

    expect(state.chainAltarOpened).toBe(true);
    expect(chroniclesInventoryEntries(state).map((item) => item.id)).not.toContain('liturgical-link');
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'bell-key',
      name: 'Llave de Campana',
      quantity: 1,
    }));
    expect(chroniclesQuestEntries(state).find((quest) => quest.id === 'silence-chain-basilica')).toMatchObject({
      status: 'active',
      objective: 'Lleva la Llave de Campana hasta la reja superior.',
    });

    for (const key of ['basilicaNorthHoundHp', 'basilicaFloorSpiderHp', 'basilicaSouthSpecterHp']) {
      expect(state[key], key).toBeGreaterThan(0);
    }
    state = { ...state, x: 10, y: 1 };
    const tower = chroniclesTacticsUse(state, 'basilica-upper-gate');

    expect(tower.mapId).toBe('hollow-bell-tower');
    expect(tower.phase).toBe('explore');
    expect({ x: tower.x, y: tower.y, direction: tower.direction }).toEqual({ x: 1, y: 1, direction: 1 });
    expect(tower.censerWispHp).toBe(0);
    expect(tower.hollowBellKeeperHp).toBe(12);
    expect(tower.westChainHoundHp).toBe(7);
    expect(tower.eastBellSpiderHp).toBe(6);
    expect(tower.bellArchivistHp).toBe(8);
    expect(tower.tollWispHp).toBe(5);
    expect(chroniclesInventoryEntries(tower).map((item) => item.id)).not.toContain('bell-key');
    expect(chroniclesQuestEntries(tower).find((quest) => quest.id === 'silence-chain-basilica')).toMatchObject({
      status: 'completed',
      objective: 'Basílica superada.',
    });
    expect(tower.journal.at(-1)?.id).toBe('chain-basilica-cleared');
  });

  it('turns the optional Archive glass drop into a Basilica reward without gating the main route', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'chain-basilica');
    state = chroniclesApplyContentEffects(state, [{
      type: 'grant-item',
      itemId: 'black-glass-drop',
      name: 'Gota de Vidrio Negro',
      description: 'Trofeo opcional del Archivo.',
      quantity: 1,
    }]);

    state = { ...state, x: 5, y: 1 };
    state = chroniclesTacticsUse(state, 'black-glass-oculus');
    expect(state.glassOculusAwake).toBe(true);
    expect(chroniclesInventoryEntries(state).map((item) => item.id)).not.toContain('black-glass-drop');

    state = { ...state, x: 7, y: 1 };
    state = chroniclesTacticsUse(state, 'oculus-cache');

    expect(state.oculusCacheOpened).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'resonant-lamina',
      name: 'Lámina Resonante',
      quantity: 1,
    }));
    expect(state.chainAltarOpened).toBe(false);
  });

  it('adds only normal reachable threats, with no extra story loot or quest progression', () => {
    const basilica = chroniclesMapById('chain-basilica');
    const original = basilica.enemies.slice(0, 5);
    const added = basilica.enemies.slice(5);
    expect(added.map((enemy) => enemy.id)).toEqual([
      'basilica-north-hound', 'basilica-floor-spider', 'basilica-south-specter',
    ]);
    expect(new Set(basilica.enemies.map((enemy) => enemy.id)).size).toBe(8);
    expect(new Set(basilica.enemies.map((enemy) => enemy.hpKey)).size).toBe(8);
    const occupied = new Set([
      basilica.partyStart, ...original,
      ...['triggers', 'interactables', 'treasures', 'traps', 'exits']
        .flatMap((group) => basilica[group] || []),
    ].filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y))
      .map((entry) => `${entry.x},${entry.y}`));
    const reached = new Set([`${basilica.partyStart.x},${basilica.partyStart.y}`]);
    const queue = [basilica.partyStart];
    for (const { x, y } of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = x + dx;
        const nextY = y + dy;
        const key = `${nextX},${nextY}`;
        if (!reached.has(key) && basilica.grid[nextY]?.[nextX] && basilica.grid[nextY][nextX] !== '#') {
          reached.add(key);
          queue.push({ x: nextX, y: nextY });
        }
      }
    }
    for (const [index, enemy] of added.entries()) {
      const tile = `${enemy.x},${enemy.y}`;
      expect(basilica.grid[enemy.y][enemy.x], enemy.id).toBe('.');
      expect(reached.has(tile), enemy.id).toBe(true);
      expect(occupied.has(tile), enemy.id).toBe(false);
      expect(Math.abs(enemy.x - basilica.partyStart.x) + Math.abs(enemy.y - basilica.partyStart.y))
        .toBeGreaterThanOrEqual(5);
      expect(enemy.optional, enemy.id).toBe(true);
      expect(enemy.activation, enemy.id).toBe('always');
      expect(enemy.onDefeat?.effects || [], enemy.id).toEqual([]);
      expect(enemy.defeatedFlag, enemy.id).toBeUndefined();
      expect(enemy.ai).toEqual(original.find((foe) => foe.id === [
        'choir-hound', 'nave-spider', 'chain-prelate',
      ][index]).ai);
      occupied.add(tile);
    }
  });

  it('remembers each new Basilica casualty after travel and checkpoint reload', () => {
    const enemies = chroniclesMapById('chain-basilica').enemies;
    for (const foe of enemies.slice(5)) {
      const fresh = chroniclesMapTransitionState(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        'chain-basilica',
      );
      expect(fresh[foe.hpKey], foe.id).toBeGreaterThan(0);
      const departed = chroniclesMapTransitionState(
        { ...fresh, [foe.hpKey]: 0 }, 'swordhaven-first-book',
      );
      const returned = chroniclesMapTransitionState(departed, 'chain-basilica');
      expect(returned[foe.hpKey], foe.id).toBe(0);
      expect(returned.ironDeaconHp).toBeGreaterThan(0);
      const checkpoint = chroniclesRunCheckpointPayload(departed, 1);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        { ...checkpoint, worldVersion: 1 },
      );
      const loaded = chroniclesMapTransitionState(restored, 'chain-basilica');
      expect(loaded[foe.hpKey], foe.id).toBe(0);
      expect(loaded.ironDeaconHp).toBeGreaterThan(0);
    }
  });
});
