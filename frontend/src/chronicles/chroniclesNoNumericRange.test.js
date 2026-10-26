import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesEnemyTargetAhead, chroniclesPartyAttackStats,
  chroniclesReduce, createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';

// Real straight road with no wall from x=10 through x=17; the spell's old
// authored reach is 2, but MM3 now cares only about unobstructed sight.
function loneDeserter() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const enemy = chroniclesActiveEnemies(base).find((e) => e.id === 'banner-road-deserter');
  const disabled = Object.fromEntries(chroniclesActiveEnemies(base)
    .filter((e) => e.id !== enemy.id).map((e) => [e.hpKey, 0]));
  return { enemy, state: {
    ...base, ...disabled, x: 10, y: 5, direction: 1,
    enemyPositions: { [enemy.id]: { x: 17, y: 5 } },
    spellbook: { bishop: ['flying-fist'] },
    rpgModifiers: { bishop: { level: 4 } },
    equipment: { matthias: { weapon: 'wooden-spear', missile: 'wooden-bow' } },
  } };
}

describe('MM3: no item-range stat, only adjacency and unobstructed sight', () => {
  it('a spear is still melee: never hits a bandit two or seven squares away', () => {
    const { enemy, state } = loneDeserter();
    expect(CHRONICLES_EQUIPMENT['wooden-spear'].description).not.toMatch(/alcance/i);
    expect(chroniclesPartyAttackStats(state, 'matthias', 'melee').reach).toBe(1);
    const twoTiles = { ...state, x: 15 };
    expect(chroniclesEnemyTargetAhead(twoTiles, 1)).toBeNull();
    const struck = chroniclesReduce(twoTiles, {
      type: 'attack', memberId: 'matthias', mode: 'melee',
    });
    expect(struck[enemy.hpKey]).toBe(twoTiles[enemy.hpKey]);
  });

  it('an offensive spell reaches a visible enemy seven tiles away and spends PH', () => {
    const { enemy, state } = loneDeserter();
    expect(chroniclesEnemyTargetAhead(state, 2)).toBeNull();
    expect(chroniclesEnemyTargetAhead(state, 7)?.enemy.id).toBe(enemy.id);
    const beforeSp = chroniclesMemberSp(state, state.party.find((p) => p.id === 'bishop'));
    const hit = chroniclesReduce(state, {
      type: 'cast', memberId: 'bishop', spellId: 'flying-fist',
    });
    expect(hit[enemy.hpKey]).toBeLessThan(state[enemy.hpKey]);
    expect(hit.turns).toBe(state.turns + 1);
    expect(chroniclesMemberSp(hit, hit.party.find((p) => p.id === 'bishop'))).toBe(beforeSp - 2);
  });

  it('a wall between caster and enemy blocks the shot without spending PH', () => {
    const { state } = loneDeserter();
    const hidden = { ...state, x: 5, y: 4, direction: 1,
      enemyPositions: { 'banner-road-deserter': { x: 7, y: 4 } } };
    expect(chroniclesEnemyTargetAhead(hidden, 20)).toBeNull();
    const blocked = chroniclesReduce(hidden, {
      type: 'cast', memberId: 'bishop', spellId: 'flying-fist',
    });
    expect(blocked.turns).toBe(hidden.turns);
    expect(blocked.message).toMatch(/línea de visión/i);
  });

  it('Tactics preserves its own attack geometry', () => {
    const tactics = createChroniclesState('banner-road-first-book');
    expect(chroniclesPartyAttackStats(tactics, 'matthias', 'melee').reach)
      .toBe(tactics.party[0].reach);
  });
});
