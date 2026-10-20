import { describe, expect, it } from 'vitest';
import { chroniclesQuestRegionHint } from './chroniclesQuestRegionHint.js';
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

  it('never fabricates a location for a finished, unknown or unrecognized quest stage', () => {
    expect(chroniclesQuestRegionHint({ id: 'banner-contract', status: 'completed' }, {})).toBeNull();
    expect(chroniclesQuestRegionHint(active('an-unwritten-contract'), {})).toBeNull();
    expect(chroniclesQuestRegionHint(active('lost-king-prologue', 'Paso aún desconocido.'), {})).toBeNull();
  });
});
