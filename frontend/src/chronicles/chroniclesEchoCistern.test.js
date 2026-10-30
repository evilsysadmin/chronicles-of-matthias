import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  chroniclesTacticsMove,
  chroniclesTacticsInteractions,
  chroniclesTacticsUse,
} from '../chroniclesOfMatthiasTactics.js';
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

describe('Chronicles Echo Cistern', () => {
  it('registers a tenth authored map with two sluices and optional side encounters', () => {
    expect(chroniclesMapIds()).toContain('echo-cistern');
    const cistern = chroniclesMapById('echo-cistern');

    expect(cistern.version).toBe(3);
    expect(cistern.grid).toHaveLength(10);
    expect(cistern.grid[0]).toHaveLength(13);
    expect(cistern.enemies.map((enemy) => enemy.id)).toEqual([
      'cistern-warden',
      'west-silt-hound',
      'east-drain-spider',
      'echo-bishop',
      'brine-wisp',
      'cistern-sluice-hound',
      'cistern-wall-spider',
      'cistern-lower-bishop',
    ]);
    expect(cistern.enemies.filter((enemy) => enemy.optional).map((enemy) => enemy.id)).toEqual([
      'echo-bishop',
      'brine-wisp',
      'cistern-sluice-hound',
      'cistern-wall-spider',
      'cistern-lower-bishop',
    ]);
    expect(cistern.interactables.filter((entry) => entry.kind === 'lever').map((entry) => entry.id)).toEqual([
      'west-sluice-wheel',
      'east-sluice-wheel',
    ]);
  });

  it('supports the normal combat route through both sluices and keeps optional enemies optional', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'echo-cistern');
    state = chroniclesTacticsUse(state, 'cistern-inscription');

    state = {
      ...state,
      westSiltHoundHp: 0,
      x: 3,
      y: 5,
    };
    state = chroniclesTacticsUse(state, 'west-sluice-wheel');
    expect(state.westSluiceSet).toBe(true);
    expect(state.eastSluiceSet).toBe(false);

    state = {
      ...state,
      eastDrainSpiderHp: 0,
      x: 9,
      y: 5,
    };
    state = chroniclesTacticsUse(state, 'east-sluice-wheel');
    expect(state.eastSluiceSet).toBe(true);

    state = {
      ...state,
      cisternWardenHp: 0,
      x: 6,
      y: 8,
    };
    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'echo-drain-seal',
      label: 'Recuperar Sello del Desagüe',
    }));
    state = chroniclesTacticsUse(state, 'echo-drain-seal');

    expect(state.echoSealClaimed).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'echo-drain-seal',
      name: 'Sello del Desagüe',
      quantity: 1,
    }));
    expect(chroniclesQuestEntries(state).find((quest) => quest.id === 'drain-echo-cistern')).toMatchObject({
      status: 'active',
      objective: 'Lleva el Sello del Desagüe hasta la salida superior.',
    });

    state = { ...state, x: 10, y: 1 };
    const escaped = chroniclesTacticsUse(state, 'cistern-upper-gate');

    expect(escaped.phase).toBe('escaped');
    expect(escaped.echoBishopHp).toBe(8);
    expect(escaped.brineWispHp).toBe(5);
    expect(chroniclesInventoryEntries(escaped).map((item) => item.id)).not.toContain('echo-drain-seal');
    expect(chroniclesQuestEntries(escaped).find((quest) => quest.id === 'drain-echo-cistern')).toMatchObject({
      status: 'completed',
      objective: 'Cisterna superada.',
    });
    expect(escaped.journal.at(-1)?.id).toBe('echo-cistern-cleared');
  });

  it('lets Bellwright Oil solve the west sluice without killing its guardian', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'echo-cistern');
    state = chroniclesApplyContentEffects(state, [
      {
        type: 'grant-item',
        itemId: 'bellwright-oil',
        name: 'Aceite de Campanero',
        description: 'Herramienta opcional heredada de la Torre.',
        quantity: 1,
      },
      {
        type: 'start-quest',
        questId: 'drain-echo-cistern',
        title: 'Drenar la Cisterna',
        description: 'Prueba de compuertas.',
        objective: 'Activa ambas compuertas y derrota al Custodio de la Cisterna.',
        order: 90,
      },
    ]);
    state = { ...state, x: 3, y: 5 };

    expect(chroniclesTacticsInteractions(state)).toContainEqual(expect.objectContaining({
      id: 'west-sluice-oil',
      label: 'Lubricar compuerta oeste',
    }));
    state = chroniclesTacticsUse(state, 'west-sluice-oil');

    expect(state.westSluiceSet).toBe(true);
    expect(state.westSiltHoundHp).toBe(7);
    expect(chroniclesInventoryEntries(state).map((item) => item.id)).not.toContain('bellwright-oil');
    expect(chroniclesQuestEntries(state).find((quest) => quest.id === 'drain-echo-cistern')).toMatchObject({
      status: 'active',
      objective: 'Activa la compuerta restante y derrota al Custodio de la Cisterna.',
    });
  });

  it('uses the Black Glass Prism to reveal optional loot without consuming the prism', () => {
    let state = chroniclesMapTransitionState(createChroniclesState(), 'echo-cistern');
    state = chroniclesApplyContentEffects(state, [{
      type: 'grant-item',
      itemId: 'black-glass-prism',
      name: 'Prisma de Vidrio Negro',
      description: 'Recompensa opcional de la Capilla.',
      quantity: 1,
    }]);
    state = { ...state, x: 7, y: 6 };

    state = chroniclesTacticsUse(state, 'prism-sounding');
    expect(state.prismCacheRevealed).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'black-glass-prism',
      quantity: 1,
    }));

    state = { ...state, x: 9, y: 6 };
    state = chroniclesTacticsUse(state, 'drowned-prism-cache');

    expect(state.prismCacheOpened).toBe(true);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({
      id: 'echo-lens',
      name: 'Lente de Eco',
      quantity: 1,
    }));
    expect(state.westSluiceSet).toBe(false);
    expect(state.eastSluiceSet).toBe(false);
  });

  it('adds an avoidable water-pressure plate that the west sluice safely disables', () => {
    const map = chroniclesMapById('echo-cistern');
    expect(map.traps).toEqual([
      expect.objectContaining({
        id: 'cistern-pressure-plate', visualType: 'chain-plate', x: 8, y: 6,
      }),
    ]);

    // A longer path through the lower gallery reaches the eastern wheel
    // without crossing the pressure plate; it is a choice, not a toll.
    const seen = new Set([`${map.partyStart.x},${map.partyStart.y}`]);
    const queue = [map.partyStart];
    for (const point of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = point.x + dx;
        const y = point.y + dy;
        const key = `${x},${y}`;
        if (key === '8,6' || seen.has(key) || !map.grid[y]?.[x] || map.grid[y][x] === '#') continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    expect(seen.has('9,5')).toBe(true);

    const defeated = Object.fromEntries(map.enemies.map((enemy) => [enemy.hpKey, 0]));
    const fresh = createChroniclesState(map.id, null, { rules: 'mm3' });
    const before = { ...fresh, ...defeated, x: 7, y: 6, direction: 1 };
    const originalHp = before.party.map((member) => member.hp);
    const hit = chroniclesReduce(before, 'forward');
    expect({ x: hit.x, y: hit.y }).toEqual({ x: 8, y: 6 });
    expect(hit.cisternPressurePlateSpent).toBe(true);
    hit.party.forEach((member, index) => {
      expect(member.hp).toBeGreaterThanOrEqual(Math.max(0, originalHp[index] - 2));
      expect(member.hp).toBeLessThanOrEqual(originalHp[index]);
    });

    const again = chroniclesReduce({ ...hit, x: 7, y: 6, direction: 1 }, 'forward');
    expect(again.party).toEqual(hit.party);
    const safe = chroniclesReduce({ ...before, westSluiceSet: true }, 'forward');
    expect(safe.cisternPressurePlateSpent).toBe(false);
    expect(safe.party).toEqual(before.party);

    const away = chroniclesMapTransitionState(hit, 'iron-foundry');
    const restored = chroniclesMapTransitionState(JSON.parse(JSON.stringify(away)), map.id);
    expect(restored.cisternPressurePlateSpent).toBe(true);
    expect(restored.party).toEqual(hit.party);

    // The same authored trap also works in the separate Tactics move path.
    const tacticsBefore = { ...createChroniclesState(map.id), ...defeated, x: 7, y: 6 };
    const tactics = chroniclesTacticsMove(tacticsBefore, { x: 8, y: 6 });
    expect(tactics.cisternPressurePlateSpent).toBe(true);
    expect(tactics.party.map((member) => member.hp)).toEqual(
      tacticsBefore.party.map((member) => (member.hp > 0 ? Math.max(0, member.hp - 2) : member.hp)),
    );
  });

});
