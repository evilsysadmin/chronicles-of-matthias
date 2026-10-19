import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesOpeningVolleyShots,
  chroniclesReduce, createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesHitImpacts } from './chroniclesHitSplats.js';
import { shouldShowChroniclesNarration } from '../components/ChroniclesNarratorOverlay.jsx';

function shootersInRoad() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  return {
    ...base, x: 10, y: 5, direction: 1,
    equipment: {
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      rook: { weapon: 'bronze-mace', missile: 'bronze-crossbow' },
      knight: { weapon: 'bronze-dagger', missile: 'wooden-sling' },
    },
  };
}

describe('Chronicles S · blood-drop impact, no routine orange message', () => {
  it('firing into empty space spends a turn, animates independently, and leaves no narrator text', () => {
    const initial = shootersInRoad();
    const empty = {
      ...initial,
      message: 'Una narración anterior',
      ...Object.fromEntries(chroniclesActiveEnemies(initial).map((foe) => [foe.hpKey, 0])),
    };
    const result = chroniclesReduce(empty, 'volley');
    expect(result.turns).toBe(empty.turns + 1);
    expect(result.message).toBe('');
    expect(chroniclesHitImpacts(empty, result)).toEqual([]);
    expect(shouldShowChroniclesNarration(result.message)).toBe(false);
    expect(shouldShowChroniclesNarration('La compañía dispara al frente, pero no hay enemigos al alcance: los proyectiles se pierden en la distancia.')).toBe(false);
  });

  it('an actual ranged salvo uses the existing numeric enemy blood drop, not the narration band', () => {
    const base = shootersInRoad();
    const state = Array.from({ length: 80 }, (_, index) => ({
      ...base, runSeed: 'projectile-splat-' + index,
    })).find((candidate) => chroniclesOpeningVolleyShots(candidate).shots.some((shot) => shot.damage > 0));
    expect(state).toBeTruthy();
    const fired = chroniclesOpeningVolleyShots(state);
    expect(fired.target).toBeTruthy();
    const totalDamage = fired.shots.reduce((sum, shot) => sum + shot.damage, 0);
    expect(totalDamage).toBeGreaterThan(0);
    const next = chroniclesReduce(state, 'volley');
    const impacts = chroniclesHitImpacts(state, next);
    expect(impacts).toContainEqual({
      kind: 'enemy', id: fired.target.id, amount: totalDamage,
      share: totalDamage / fired.target.maxHp,
    });
    expect(shouldShowChroniclesNarration(next.message)).toBe(false);
    expect(shouldShowChroniclesNarration('Has descubierto una cripta olvidada.')).toBe(true);
  });
});
