import { describe, expect, it } from 'vitest';
import { chroniclesPartyAttackStats, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesMM3AttackHits, chroniclesMM3EnemyArmorClass } from './chroniclesMM3Rules.js';

const SWORDHAVEN_STREET_ENEMIES = [
  'swordhaven-south-cutpurse',
  'swordhaven-south-false-watch',
  'swordhaven-old-quarter-pickpocket',
  'swordhaven-false-watch-recruit',
];

describe('MM3 level-1 street encounter balance', () => {
  it('keeps the canonical starting fighter accurate without an inflated base to-hit', () => {
    const fresh = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    expect(chroniclesPartyAttackStats(fresh, 'matthias', 'melee'))
      .toMatchObject({ toHit: 2, damage: 3 });

    const equipped = {
      ...fresh,
      equipment: {
        matthias: { weapon: 'roadwatch-sabre', armor: 'roadwatch-vest' },
      },
    };
    // The +5 reported in play comes from level, Accuracy, sabre and vest.
    expect(chroniclesPartyAttackStats(equipped, 'matthias', 'melee'))
      .toMatchObject({ toHit: 5, damage: 6 });
  });

  it('requires more than one good sabre hit against the first street enemies without making them evasive', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const equipped = {
      ...state,
      equipment: { matthias: { weapon: 'roadwatch-sabre', armor: 'roadwatch-vest' } },
    };
    const attack = chroniclesPartyAttackStats(equipped, 'matthias', 'melee');
    const map = chroniclesMapById('swordhaven-first-book');

    for (const id of SWORDHAVEN_STREET_ENEMIES) {
      const enemy = map.enemies.find((candidate) => candidate.id === id);
      expect(enemy, id).toBeDefined();
      // Check the actual normalized EnemyBuild HP, not merely the JSON base.
      expect(enemy.maxHp, id).toBeGreaterThan(attack.damage);
      expect(enemy.maxHp, id).toBeLessThanOrEqual(attack.damage * 1.5);
      const armorClass = chroniclesMM3EnemyArmorClass(enemy);
      const successes = Array.from({ length: 20 }, (_, index) => index + 1)
        .filter((roll) => chroniclesMM3AttackHits(roll, attack.toHit, armorClass)).length;
      expect(successes / 20, id).toBeGreaterThanOrEqual(0.6);
      expect(successes / 20, id).toBeLessThanOrEqual(0.75);
    }
  });
});
