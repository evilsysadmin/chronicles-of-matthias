import { describe, expect, it } from 'vitest';
import { chroniclesQuestRegionHint, chroniclesQuestRegionContext, chroniclesHudQuestDestination } from './chroniclesQuestRegionHint.js';
import { createChroniclesState, chroniclesObjective } from '../chroniclesOfMatthias.js';
import questRegionHints from './campaign/quest-region-hints.json';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const active = (id, objective = '') => ({ id, status: 'active', objective });

describe('authored first-book quest geography', () => {
  it('points the banner seeker to the authored road and back to Swordhaven after recovery', () => {
    expect(chroniclesQuestRegionHint(active('banner-contract'), {}))
      .toMatchObject({ mapId: 'banner-road-first-book', region: 'Camino de los Estandartes', kind: 'Exterior' });
    expect(chroniclesQuestRegionHint(active('banner-contract'), { bannerFound: true }))
      .toMatchObject({ mapId: 'swordhaven-first-book', region: 'Swordhaven', kind: 'Pueblo' });
    expect(chroniclesQuestRegionHint(active('banner-contract'), {
      inventory: { 'knight-banner': { quantity: 1 } },
    }).mapId).toBe('swordhaven-first-book');
  });

  it('only changes the bandit return area after BOTH authored enemies are defeated', () => {
    expect(chroniclesQuestRegionHint(active('road-bandits'), { bannerRoadDeserterDefeated: true }).mapId)
      .toBe('banner-road-first-book');
    expect(chroniclesQuestRegionHint(active('road-bandits'), {
      bannerRoadDeserterDefeated: true, bannerRoadCaptainDefeated: true,
    }).mapId).toBe('swordhaven-first-book');
  });

  it('uses Rookwood for actual forest objectives; silk turn-in returns to the temple', () => {
    expect(chroniclesQuestRegionHint(active('names-in-wood'), {}).mapId).toBe('rookwood-first-book');
    expect(chroniclesQuestRegionHint(active('weaver-silk'), {}).mapId).toBe('rookwood-first-book');
    expect(chroniclesQuestRegionHint(active('weaver-silk'), {
      inventory: { 'weaver-silk': { quantity: 1 } },
    }).mapId).toBe('swordhaven-first-book');
  });

  it('uses only explicitly authored stages of the king prologue', () => {
    expect(chroniclesQuestRegionHint(active('lost-king-prologue',
      'Investiga el antiguo sello de la Cripta de las Ocho Casillas.'), {}).mapId)
      .toBe('crypt-eight-squares');
    expect(chroniclesQuestRegionHint(active('lost-king-prologue',
      'Regresa a Swordhaven para registrar el hallazgo.'), {}).mapId)
      .toBe('swordhaven-square');
    expect(chroniclesQuestRegionHint(active('lost-king-prologue',
      'Investiga la Puerta Negra y busca documentación en la Galería de las Bifurcaciones.'), {}).mapId)
      .toBe('gallery-of-forks');
  });

  it('locates six authored Terra errands and hunts without inventing routes', () => {
    const destinations = [
      ['ascua-smith-errand', 'terra-f3', 'Crestas Volcánicas'],
      ['ascua-watch-hunt', 'terra-f4', 'Fundición en Ruinas'],
      ['ascua-dragon-scale', 'guarida-del-dragon', 'Guarida del Dragón de Ceniza'],
      ['molinoviejo-wind', 'terra-b2', 'Brezal de los Lobos'],
      ['molinoviejo-watch-hunt', 'terra-b4', 'Granjas del Trigo'],
      ['pinohelado-watch-hunt', 'terra-c2', 'Colinas de la Corona'],
    ];
    for (const [questId, mapId, region] of destinations) {
      const hint = chroniclesQuestRegionHint(active(questId), {});
      expect(hint).toMatchObject({ mapId, region });
      expect(hint.clue.length).toBeGreaterThan(12);
      expect(chroniclesQuestRegionHint({ id: questId, status: 'completed' }, {})).toBeNull();
    }
  });

  it('returns to the right quest giver after a real item or victory flag', () => {
    const returns = [
      ['ascua-smith-errand', { inventory: { 'lava-glass': { quantity: 1 } } }, 'ascuafria'],
      ['ascua-watch-hunt', { ascua_watchHunted: true }, 'ascuafria'],
      ['ascua-dragon-scale', { inventory: { 'dragon-scale': { quantity: 1 } } }, 'ascuafria'],
      ['molinoviejo-wind', { molinoviejoWindPact: true }, 'molinoviejo'],
      ['molinoviejo-wind', { molinoviejoWindSlain: true }, 'molinoviejo'],
      ['molinoviejo-watch-hunt', { molinoviejo_watchHunted: true }, 'molinoviejo'],
      ['pinohelado-watch-hunt', { pinohelado_watchHunted: true }, 'pinohelado'],
    ];
    for (const [questId, state, mapId] of returns) {
      expect(chroniclesQuestRegionHint(active(questId), state).mapId).toBe(mapId);
    }
    // A merely accepted hunt must not prematurely redirect to its reward.
    expect(chroniclesQuestRegionHint(active('ascua-watch-hunt'),
      { ascua_watchHunted: false }).mapId).toBe('terra-f4');
    expect(chroniclesQuestRegionHint(active('molinoviejo-wind'),
      { molinoviejoWindPact: false }).mapId).toBe('terra-b2');
  });

  it('points Osric\'s Lost Names hunt to the real Tower, then back to Vigilia after a proven victory', () => {
    const quest = active('lost-names', 'Sube a la Torre de los Nombres (A1), derrota al Escriba y trae su libro a Osric (C1).');
    expect(chroniclesQuestRegionHint(quest, {})).toMatchObject({
      mapId: 'torre-de-los-nombres', region: 'Torre de los Nombres', kind: 'Mazmorra',
    });
    expect(chroniclesQuestRegionHint(quest, { osricTowerStarted: true }).mapId)
      .toBe('torre-de-los-nombres');
    // The actual boss sets this flag and awards this item in the authored map.
    for (const state of [
      { torre_de_los_nombresBossDefeated: true },
      { inventory: { 'book-of-names': { quantity: 1 } } },
    ]) {
      expect(chroniclesQuestRegionHint(quest, state)).toMatchObject({
        mapId: 'vigilia-del-norte', region: 'Vigilia del Norte', kind: 'Pueblo',
      });
    }
    expect(chroniclesQuestRegionHint({
      ...quest, status: 'completed',
    }, { torre_de_los_nombresBossDefeated: true })).toBeNull();
    // An unaccepted quest or unrelated destination must stay unknown.
    expect(chroniclesQuestRegionHint(active('missing-lost-names'), {})).toBeNull();
  });

  it('shows Osric\'s authored destination in HUD only while tracking that real quest', () => {
    const objective = 'Sube a la Torre de los Nombres (A1), derrota al Escriba y trae su libro a Osric (C1).';
    const quest = { id: 'lost-names', title: 'Los nombres perdidos', status: 'active', objective, order: 1 };
    const state = {
      ...createChroniclesState('vigilia-del-norte'),
      trackedQuestId: 'lost-names',
      quests: { 'lost-names': quest },
    };
    expect(chroniclesHudQuestDestination(state, objective)).toEqual({
      mapId: 'torre-de-los-nombres', region: 'Torre de los Nombres',
    });
    expect(chroniclesHudQuestDestination(state, 'Una orden de combate sin geografía')).toBeNull();
    const returned = { ...state, mapId: 'terra-a1', torre_de_los_nombresBossDefeated: true };
    expect(chroniclesHudQuestDestination(returned, objective)).toEqual({
      mapId: 'vigilia-del-norte', region: 'Vigilia del Norte',
    });
    expect(chroniclesHudQuestDestination({ ...returned, mapId: 'vigilia-del-norte' }, objective))
      .toBeNull();
  });

  it('validates all authored clues and map references without embedding coordinates', () => {
    for (const [questId, stages] of Object.entries(questRegionHints)) {
      expect(questId.length).toBeGreaterThan(0);
      expect(stages.length).toBeGreaterThan(0);
      for (const stage of stages) {
        expect(chroniclesMapById(stage.mapId)?.id).toBe(stage.mapId);
        expect(typeof stage.clue).toBe('string');
        expect(stage.clue.trim().length).toBeGreaterThan(8);
        expect(stage).not.toHaveProperty('x');
        expect(stage).not.toHaveProperty('y');
        if (stage.when) expect(stage.when.every((rule) =>
          Boolean(rule.itemId || rule.key))).toBe(true);
        if (stage.objectiveIncludes) expect(stage.objectiveIncludes.every(
          (text) => typeof text === 'string' && text.length >= 4,
        )).toBe(true);
      }
    }
  });

  it('orients from actual party location without pretending to know a route', () => {
    const sought = chroniclesQuestRegionHint(active('banner-contract'), {});
    expect(chroniclesQuestRegionContext(sought, { mapId: 'swordhaven-first-book' }))
      .toMatchObject({ relation: 'another-region', text: expect.stringContaining('Camino de los Estandartes') });
    expect(chroniclesQuestRegionContext(sought, { mapId: 'banner-road-first-book' }))
      .toMatchObject({ relation: 'same-map' });

    const found = chroniclesQuestRegionHint(active('banner-contract'), { bannerFound: true });
    expect(chroniclesQuestRegionContext(found, { mapId: 'swordhaven-square' }))
      .toMatchObject({ relation: 'same-region' });
    expect(chroniclesQuestRegionContext(null, { mapId: 'swordhaven-square' })).toBeNull();
    expect(chroniclesQuestRegionContext(found, {})).toBeNull();
  });

  it('never fabricates a location for a finished, unknown or unrecognized quest stage', () => {
    expect(chroniclesQuestRegionHint({ id: 'banner-contract', status: 'completed' }, {})).toBeNull();
    expect(chroniclesQuestRegionHint(active('an-unwritten-contract'), {})).toBeNull();
    expect(chroniclesQuestRegionHint(active('lost-king-prologue', 'Paso aún desconocido.'), {})).toBeNull();
  });
});

describe('HUD location for quests outside the current map', () => {
  const bannerObjective = 'Busca el estandarte cerca del mojón sin nombre.';
  function stateWithQuest(mapId = 'swordhaven-first-book', extras = {}) {
    return {
      ...createChroniclesState(mapId),
      quests: {
        'banner-contract': {
          id: 'banner-contract',
          title: 'El estandarte perdido',
          status: 'active',
          order: 1,
          objective: bannerObjective,
        },
      },
      ...extras,
    };
  }

  it('explains that the banner is on the Road, not in Swordhaven', () => {
    const state = stateWithQuest();
    const objective = chroniclesObjective(state);
    expect(objective).toBe(bannerObjective);
    expect(chroniclesHudQuestDestination(state, objective)).toEqual({
      mapId: 'banner-road-first-book',
      region: 'Camino de los Estandartes',
    });
    expect(state.mapId).toBe('swordhaven-first-book');
    expect(state.turns).toBe(0);
  });

  it('does not add an off-map cue when already on the correct road', () => {
    const state = stateWithQuest('banner-road-first-book');
    expect(chroniclesHudQuestDestination(state, chroniclesObjective(state))).toBeNull();
  });

  it('changes target to the turn-in location only when the banner is actually found', () => {
    const found = stateWithQuest('banner-road-first-book', { bannerFound: true });
    expect(chroniclesHudQuestDestination(found, chroniclesObjective(found))).toEqual({
      mapId: 'swordhaven-first-book', region: 'Swordhaven',
    });
    const atHome = stateWithQuest('swordhaven-first-book', { bannerFound: true });
    expect(chroniclesHudQuestDestination(atHome, chroniclesObjective(atHome))).toBeNull();
    const adjacentTownMap = stateWithQuest('swordhaven-square', { bannerFound: true });
    expect(chroniclesHudQuestDestination(adjacentTownMap, chroniclesObjective(adjacentTownMap))).toBeNull();
  });

  it('never invents a destination for unrelated tactical messages, unknown or completed missions', () => {
    const state = stateWithQuest();
    expect(chroniclesHudQuestDestination(state, 'Derrota al ladrón')).toBeNull();
    expect(chroniclesHudQuestDestination({
      ...state, quests: {
        unknown: { id: 'unknown', status: 'active', objective: 'Recoge algo sin ubicación.' },
      },
    }, 'Recoge algo sin ubicación.')).toBeNull();
    expect(chroniclesHudQuestDestination({
      ...state, quests: {
        'banner-contract': { ...state.quests['banner-contract'], status: 'completed' },
      },
    }, bannerObjective)).toBeNull();
  });

  it('respects the reducer’s tracked quest selection instead of displaying a different mission', () => {
    const state = stateWithQuest('swordhaven-first-book', {
      trackedQuestId: 'names-in-wood',
      quests: {
        'banner-contract': { id: 'banner-contract', status: 'active', order: 0, objective: bannerObjective },
        'names-in-wood': { id: 'names-in-wood', status: 'active', order: 1, objective: 'Busca las placas del bosque.' },
      },
    });
    const objective = chroniclesObjective(state);
    expect(objective).toBe('Busca las placas del bosque.');
    expect(chroniclesHudQuestDestination(state, objective))
      .toMatchObject({ mapId: 'rookwood-first-book', region: 'Rookwood' });
    expect(chroniclesHudQuestDestination(state, bannerObjective)).toBeNull();
  });
});
