import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceOpeningVolley,
  chroniclesPrecontactMeleeContact,
  chroniclesTouchVolleyOpportunity,
} from './chroniclesPrecontactVolley.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';

function rangedCompany() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  return {
    ...base, x: 10, y: 5, direction: 1,
    equipment: {
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      knight: { weapon: 'bronze-dagger', missile: 'wooden-bow' },
    },
  };
}

describe('Chronicles · pre-contact MM3 ranged exchanges (#134)', () => {
  it('does not roll initiative for a ranged shot merely because an enemy is sighted at bow range', () => {
    const base = rangedCompany();
    const target = chroniclesEnemyTargetAhead(base, 3);
    expect(target).toBeTruthy();
    const shot = chroniclesOpeningVolleyShots(base);
    expect(shot.shots.length).toBeGreaterThan(0);
    const result = chroniclesReduce(base, { type: 'volley' });
    const after = chroniclesAdvanceOpeningVolley(base, result);
    expect(after.turns).toBe(base.turns + 1);
    expect(after.round).toBe(Number(base.round || 0) + 1);
    expect(after.message).toMatch(/Salva de/);
    expect(after.initiative || null).toBeNull();
    expect(after.party.some((hero) => hero.hp < 0)).toBe(false);
  });

  it('preserves an enemy advance (or a legitimate ranged reply), without multiple enemy turns per shooter', () => {
    const base = rangedCompany();
    const target = chroniclesEnemyTargetAhead(base, 3);
    expect(target).toBeTruthy();
    const fired = chroniclesReduce(base, 'volley');
    const next = chroniclesAdvanceOpeningVolley(base, fired);
    const beforeEnemy = chroniclesRuntimeEnemyPosition(base, target.enemy);
    const afterEnemy = chroniclesRuntimeEnemyPosition(next, target.enemy);
    const movement = Math.abs(afterEnemy.x - beforeEnemy.x) + Math.abs(afterEnemy.y - beforeEnemy.y);
    // Some targets may be killed by the opening volley; otherwise their
    // authored AI has at most one action and cannot cross several tiles.
    expect(movement).toBeLessThanOrEqual(2);
    expect((next.enemyTurnEvents || []).filter((event) => event.type === 'attack').length).toBeLessThanOrEqual(1);
  });

  it('exposes group shooting on touch independently of the selected hero, while giving adjacency to melee', () => {
    const base = rangedCompany();
    expect(chroniclesTouchVolleyOpportunity(base)).toEqual({ available: true, shooters: 2 });
    // No weapon, no magical projectile: the button stays on melee.
    expect(chroniclesTouchVolleyOpportunity({ ...base, equipment: {} }))
      .toEqual({ available: false, shooters: 0 });
    const target = chroniclesEnemyTargetAhead(base, 3);
    const adjacent = {
      ...base,
      enemyPositions: { ...base.enemyPositions, [target.enemy.id]: { x: base.x + 1, y: base.y } },
    };
    expect(chroniclesTouchVolleyOpportunity(adjacent).available).toBe(false);
    expect(chroniclesTouchVolleyOpportunity({ ...base, initiative: { order: [] } }).available).toBe(false);
  });

  it('does not grant an enemy response when no legal shot was launched', () => {
    const state = { ...rangedCompany(), equipment: {} };
    const refused = chroniclesReduce(state, 'volley');
    const after = chroniclesAdvanceOpeningVolley(state, refused);
    expect(after).toBe(refused);
  });

  it('detects physical contact, not mere long-range engagement, and never shoots through dead enemies', () => {
    const base = rangedCompany();
    const enemy = chroniclesActiveEnemies(base).find((candidate) => candidate.id === chroniclesEnemyTargetAhead(base, 3)?.enemy.id);
    expect(enemy).toBeTruthy();
    const far = { ...base, enemyPositions: { ...base.enemyPositions, [enemy.id]: { x: base.x + 3, y: base.y } } };
    expect(chroniclesPrecontactMeleeContact(far)).toBe(false);
    const near = { ...far, enemyPositions: { ...far.enemyPositions, [enemy.id]: { x: base.x + 1, y: base.y } } };
    expect(chroniclesPrecontactMeleeContact(near)).toBe(true);
    const dead = { ...near, [enemy.hpKey]: 0 };
    expect(chroniclesPrecontactMeleeContact(dead)).toBe(false);
  });
});
