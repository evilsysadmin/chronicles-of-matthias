import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  chroniclesActiveEnemies,
  chroniclesCombatMeleeTarget,
  chroniclesCombatPartyStepBlocked,
  chroniclesMM3MeleeAvailable,
  chroniclesMM3TurnActionReady,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import ChroniclesCombatRoster, { chroniclesRosterActionTarget } from '../components/ChroniclesCombatRoster.jsx';

const MARAUDER_ID = 'banner-road-north-marauder';

function roadsideFight() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const all = chroniclesActiveEnemies(base);
  const enemy = all.find(candidate => candidate.id === MARAUDER_ID);
  expect(enemy?.name).toBe('salteador de la calzada');
  const prepared = {
    ...base,
    ...Object.fromEntries(all.filter(candidate => candidate.id !== enemy.id)
      .map(candidate => [candidate.hpKey, 0])),
    x: 5, y: 2, direction: 0,
    enemyPositions: { [enemy.id]: { x: 5, y: 3 } },
  };
  const fight = chroniclesStartInitiativeCombat(prepared, [enemy], { random: () => 0 });
  expect(fight.phase).toBe('combat');
  const heroCursor = fight.initiative.order.findIndex(actor => actor.kind === 'party');
  const enemyCursor = fight.initiative.order.findIndex(actor => actor.kind === 'enemy');
  expect(heroCursor).toBeGreaterThanOrEqual(0);
  expect(enemyCursor).toBeGreaterThanOrEqual(0);
  const active = {
    ...fight, initiative: { ...fight.initiative, cursor: heroCursor },
  };
  const hero = active.initiative.order[heroCursor];
  return { active, hero, enemyCursor, enemy };
}

describe('MM3 initiative: action availability must agree across reducer, HUD and direct input', () => {
  it('allows exactly one genuine melee action by the awake current hero', () => {
    const { active, hero, enemy } = roadsideFight();
    expect(chroniclesMM3TurnActionReady(active, hero.id)).toBe(true);
    expect(chroniclesMM3MeleeAvailable(active, hero.id)).toBe(true);
    expect(chroniclesCombatMeleeTarget(active)?.enemy.id).toBe(enemy.id);
    expect(chroniclesRosterActionTarget(active)).toEqual({ id: enemy.id, mode: 'melee' });
    const html = renderToStaticMarkup(React.createElement(ChroniclesCombatRoster, { state: active }));
    expect(html).toContain('data-chronicles-target-mode="melee"');
    const attacked = chroniclesReduce(active, { type: 'attack', memberId: hero.id, mode: 'melee' });
    expect(attacked.turns).toBe(active.turns + 1);
    expect(attacked.direction).toBe(active.direction);
    // No second action, even if a stale input event reaches the reducer.
    expect(chroniclesReduce(attacked, { type: 'attack', memberId: hero.id, mode: 'melee' }))
      .toBe(attacked);
  });

  it.each(['asleep', 'spent', 'blocking', 'enemy-turn'])(
    'rejects %s hero actions without a ghost target, swing or turn cost',
    (caseName) => {
      const { active, hero, enemyCursor, enemy } = roadsideFight();
      const state = caseName === 'asleep'
        ? { ...active, initiative: { ...active.initiative, order: active.initiative.order.map(
          (actor, index) => index === active.initiative.cursor ? { ...actor, asleep: true } : actor,
        ) } }
        : caseName === 'spent'
          ? { ...active, combatActionSpent: { [hero.id]: true } }
          : caseName === 'blocking'
            ? { ...active, combatBlock: { [hero.id]: true } }
            : { ...active, initiative: { ...active.initiative, cursor: enemyCursor } };
      expect(chroniclesMM3TurnActionReady(state, hero.id)).toBe(false);
      expect(chroniclesMM3MeleeAvailable(state, hero.id)).toBe(false);
      expect(chroniclesCombatMeleeTarget(state)?.enemy.id).toBe(enemy.id);
      expect(chroniclesRosterActionTarget(state)).toBeNull();
      const html = renderToStaticMarkup(React.createElement(ChroniclesCombatRoster, { state }));
      expect(html).toContain(enemy.name);
      expect(html).not.toContain('data-chronicles-target-mode=');
      expect(html).not.toContain('data-target="true"');
      expect(chroniclesCombatPartyStepBlocked(state, 'forward')).toBe(true);
      for (const action of [
        { type: 'attack', memberId: hero.id, mode: 'melee' },
        { type: 'block', memberId: hero.id },
        { type: 'cast', memberId: hero.id, spellId: 'first-aid', targetId: hero.id },
        { type: 'use-item', memberId: hero.id, itemId: 'healing-potion', targetId: hero.id },
      ]) {
        expect(chroniclesReduce(state, action)).toBe(state);
      }
      for (const turn of ['turn-left', 'turn-right']) {
        expect(chroniclesReduce(state, turn)).toBe(state);
      }
    },
  );

  it('does not apply the MM3 gate to the independent Tactics mode', () => {
    const { active, hero } = roadsideFight();
    const tactics = { ...active, combatRules: null };
    expect(chroniclesMM3TurnActionReady(tactics, hero.id)).toBe(false);
    expect(chroniclesCombatPartyStepBlocked(tactics, 'forward')).toBe(false);
    expect(chroniclesMM3MeleeAvailable(tactics, hero.id)).toBe(true);
  });
});
