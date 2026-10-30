import { describe, expect, it } from 'vitest';
import { chroniclesEngagedEnemies } from './chroniclesInitiative.js';

// The sewers have a clear two-tile corridor between these positions.
// Test the Tactics engagement path too: MM3 additionally requires an attack.
const base = {
  mapId: 'swordhaven-sewers',
  phase: 'explore',
  x: 11, y: 17,
  party: [{ id: 'matthias', hp: 8, agility: 3 }],
  tobiasHp: 5,
};
const enemyAtRange = (engageRange) => ({
  id: 'tobias', hpKey: 'tobiasHp', x: 9, y: 17,
  ai: { attackReach: 1, engageRange },
});

describe('legacy enemy engagement distance bounds', () => {
  it.each([2.5, '2.5', 65, 1_000_000, '1e6'])(
    'does not fabricate distant Tactics combat from invalid range %s',
    (range) => {
      const enemy = enemyAtRange(range);
      expect(chroniclesEngagedEnemies(base, [enemy])).toEqual([]);
      // Corrupt detection never disables an otherwise legal adjacent fight.
      expect(chroniclesEngagedEnemies({ ...base, x: 10 }, [enemy])).toEqual([enemy]);
    },
  );

  it.each([2, '2', 16, '16'])(
    'keeps valid authored and legacy numeric-string engagement %s',
    (range) => {
      const enemy = enemyAtRange(range);
      expect(chroniclesEngagedEnemies(base, [enemy])).toEqual([enemy]);
      // First-person MM3 still starts initiative only when a real attack
      // is possible, not merely when a creature detects the party.
      expect(chroniclesEngagedEnemies({ ...base, combatRules: 'mm3' }, [enemy])).toEqual([]);
    },
  );
});
