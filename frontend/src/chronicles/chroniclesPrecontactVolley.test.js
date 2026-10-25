import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShots,
  chroniclesCombatMissileTarget,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesAdvanceOpeningVolley,
  chroniclesMissileRefusal,
  chroniclesPrecontactMeleeContact,
  chroniclesTouchVolleyOpportunity,
} from './chroniclesPrecontactVolley.js';


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
  it('starts initiative immediately after attacking a visible foe, even on a miss', () => {
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
    const alive = Number(result[target.enemy.hpKey] || 0) > 0;
    expect(Boolean(after.initiative), 'surviving targets must enter combat').toBe(alive);
    if (alive) expect(after.initiative.order.some((actor) => actor.id === target.enemy.id)).toBe(true);
    expect(after.party.some((hero) => hero.hp < 0)).toBe(false);
  });

  it('rolls initiative only once for a whole volley, with no extra enemy reply before combat', () => {
    const base = rangedCompany();
    const target = chroniclesEnemyTargetAhead(base, 3);
    expect(target).toBeTruthy();
    const fired = chroniclesReduce(base, 'volley');
    const next = chroniclesAdvanceOpeningVolley(base, fired);
    const alive = Number(fired[target.enemy.hpKey] || 0) > 0;
    expect(Boolean(next.initiative)).toBe(alive);
    expect((next.enemyTurnEvents || []).filter((event) => event.type === 'attack')).toHaveLength(0);
    if (alive) expect(next.initiative.order.filter((actor) => actor.id === target.enemy.id)).toHaveLength(1);
  });

  it('at four visible squares S provokes an encounter without pretending a range-three bow hits', () => {
    const base = rangedCompany();
    const target = chroniclesEnemyTargetAhead(base, 3);
    expect(target).toBeTruthy();
    const far = {
      ...base,
      enemyPositions: { ...base.enemyPositions, [target.enemy.id]: { x: base.x + 4, y: base.y } },
    };
    expect(chroniclesEnemyTargetAhead(far, 3)).toBeNull();
    expect(chroniclesEnemyTargetAhead(far, 4)?.enemy.id).toBe(target.enemy.id);
    expect(chroniclesTouchVolleyOpportunity(far)).toEqual({ available: true, shooters: 2 });
    const fired = chroniclesReduce(far, { type: 'volley' });
    expect(fired[target.enemy.hpKey]).toBe(far[target.enemy.hpKey]);
    const engaged = chroniclesAdvanceOpeningVolley(far, fired);
    expect(engaged.initiative?.order.some((actor) => actor.id === target.enemy.id)).toBe(true);
    expect(engaged.message).toMatch(/fuera de alcance/i);
    expect(engaged.message).toMatch(/comienza el combate/i);
    expect(engaged.turns).toBe(far.turns + 1);
    expect(engaged[target.enemy.hpKey]).toBe(far[target.enemy.hpKey]);
  });

  it('never provokes from an empty corridor or with no legal ranged weapon', () => {
    const base = rangedCompany();
    const clear = {
      ...base,
      ...Object.fromEntries(chroniclesActiveEnemies(base).map((enemy) => [enemy.hpKey, 0])),
    };
    const missed = chroniclesReduce(clear, 'volley');
    expect(chroniclesAdvanceOpeningVolley(clear, missed)).toBe(missed);
    expect(chroniclesTouchVolleyOpportunity(clear)).toEqual({ available: false, shooters: 0 });
    const unarmed = { ...base, equipment: {} };
    const refused = chroniclesReduce(unarmed, 'volley');
    expect(chroniclesAdvanceOpeningVolley(unarmed, refused)).toBe(refused);
  });

  it('exposes group shooting on touch independently of the selected hero, while giving adjacency to melee', () => {
    const base = rangedCompany();
    // The authored road fixture has a nearby deserter; use x12 for a
    // genuinely ranged encounter before contact.
    // Reposition it to x12 to exercise a genuinely ranged encounter.
    const target = chroniclesEnemyTargetAhead(base, 3);
    const ranged = {
      ...base,
      enemyPositions: { ...base.enemyPositions, [target.enemy.id]: { x: base.x + 2, y: base.y } },
    };
    expect(chroniclesTouchVolleyOpportunity(ranged)).toEqual({ available: true, shooters: 2 });
    // No weapon, no magical projectile: the button stays on melee.
    expect(chroniclesTouchVolleyOpportunity({ ...ranged, equipment: {} }))
      .toEqual({ available: false, shooters: 0 });
    const adjacent = {
      ...ranged,
      enemyPositions: { ...ranged.enemyPositions, [target.enemy.id]: { x: base.x + 1, y: base.y } },
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

describe('S / melee-range missile contract', () => {
  it('refuses a company volley without any legal weapon: no turn, HP, XP or animation source', () => {
    const base = { ...rangedCompany(), equipment: {} };
    expect(chroniclesMissileRefusal(base)).toBe('Sin arma a distancia');
    expect(chroniclesOpeningVolleyShots(base).shooters).toEqual([]);
    const after = chroniclesReduce(base, { type: 'volley' });
    expect(after.turns).toBe(base.turns);
    expect(after.inventory).toBe(base.inventory);
    expect(chroniclesAdvanceOpeningVolley(base, after)).toBe(after);
  });

  it('refuses an unarmed active hero in initiative without spending the actor turn', () => {
    const base = rangedCompany();
    const active = {
      ...base, phase: 'combat',
      initiative: { order: [{ kind: 'party', id: 'rook' }], cursor: 0, round: 1 },
    };
    expect(chroniclesMissileRefusal(active, 'rook')).toBe('Sin arma a distancia');
    const after = chroniclesReduce(active, { type: 'attack', memberId: 'rook', mode: 'missile' });
    expect(after.turns).toBe(active.turns);
    expect(chroniclesMissileRefusal(active, 'matthias')).toBeNull();
  });

  it('permits a real missile hit at melee distance while engaged, even when enemy is to the side', () => {
    const base = rangedCompany();
    const sighted = chroniclesEnemyTargetAhead(base, 3);
    expect(sighted).toBeTruthy();
    const enemy = sighted.enemy;
    const close = {
      ...base, phase: 'combat',
      direction: 0,
      enemyPositions: {
        ...base.enemyPositions, [enemy.id]: { x: base.x + 1, y: base.y },
      },
      initiative: { order: [
        { kind: 'party', id: 'matthias' },
        { kind: 'enemy', id: enemy.id },
      ], cursor: 0, round: 1 },
    };
    expect(chroniclesEnemyTargetAhead(close, 3)).toBeNull();
    expect(chroniclesCombatMissileTarget(close, 3)?.enemy.id).toBe(enemy.id);
    expect(chroniclesMissileRefusal(close, 'matthias')).toBeNull();
    const resolved = chroniclesReduce(close, { type: 'attack', memberId: 'matthias', mode: 'missile' });
    expect(resolved.turns).toBe(close.turns + 1);
    expect(resolved.message).toMatch(/(falla|impacta|derrota|acaba con)/i);
  });
});
