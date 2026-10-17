import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import {
  chroniclesAreaCodeForMap, chroniclesObjectiveDestination, chroniclesRouteFirstExit, chroniclesRouteHint, chroniclesWorldMapModel,
} from './chroniclesWorldMap.js';

const at = (mapId) => chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId }]);

describe('Chronicles world map', () => {
  it('places every map in its Terra area, Swordhaven included', () => {
    expect(chroniclesAreaCodeForMap('terra-c5')).toBe('C5');
    expect(chroniclesAreaCodeForMap('salinas-hundidas')).toBe('C6');
    expect(chroniclesAreaCodeForMap('swordhaven-first-book')).toBe('C3');
    expect(chroniclesAreaCodeForMap('templo-corona-trono')).toBe('F6');
  });

  it('reads the destination from the objective text', () => {
    expect(chroniclesObjectiveDestination('Baja a las Salinas Hundidas (C6) y encuentra lo que queda de la escolta.'))
      .toMatchObject({ mapId: 'salinas-hundidas', code: 'C6' });
    expect(chroniclesObjectiveDestination('Habla con el campanero de Puerto de Hollín (A3).'))
      .toMatchObject({ mapId: 'puerto-de-hollin', code: 'A3' });
    expect(chroniclesObjectiveDestination('Acaba con la bestia en E2 (E2).')).toMatchObject({ mapId: 'terra-e2', code: 'E2' });
    expect(chroniclesObjectiveDestination('Preséntate al alcalde Aldric en el ayuntamiento')).toBeNull();
  });

  it('finds the first exit of the way there and says which side it is on', () => {
    const state = at('vado-de-sal');
    const hop = chroniclesRouteFirstExit(state, 'salinas-hundidas');
    expect(hop?.toMapId).toBe('terra-c5');
    const hint = chroniclesRouteHint(at('terra-c5'), { mapId: 'salinas-hundidas', code: 'C6' });
    expect(hint?.toMapId).toBe('terra-c6');
    expect(hint?.text).toMatch(/sur/);
  });

  it('respects locks on the current map', () => {
    // The temple door in F6 stays shut until the Dama opens the final act.
    expect(chroniclesRouteFirstExit(at('terra-f6'), 'templo-corona-atrio')).toBeNull();
  });

  it('builds a 6×6 model with what has been seen and where the objective is', () => {
    const model = chroniclesWorldMapModel({
      state: at('terra-c5'),
      visitedMapIds: ['swordhaven-first-book', 'terra-c4'],
      objective: 'Baja a las Salinas Hundidas (C6)',
    });
    expect(model.cells).toHaveLength(36);
    const cell = (code) => model.cells.find((entry) => entry.code === code);
    expect(cell('C5')).toMatchObject({ here: true, visited: true });
    expect(cell('C3').visited).toBe(true);
    expect(cell('C6')).toMatchObject({ target: true, visited: false, title: null });
    expect(cell('A3').towns).toContain('Puerto de Hollín');
    expect(cell('A4').dungeons).toEqual([]);
  });
});
