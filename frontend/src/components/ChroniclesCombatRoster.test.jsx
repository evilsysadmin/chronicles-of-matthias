import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { chroniclesActiveEnemies, chroniclesEnemyTargetAhead, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from '../chronicles/chroniclesInitiative.js';
import ChroniclesCombatRoster, { chroniclesHealthBand, chroniclesThreatBearing, chroniclesRosterActionTarget } from './ChroniclesCombatRoster.jsx';
import ChroniclesMinimap from './ChroniclesMinimap.jsx';

describe('ChroniclesCombatRoster', () => {
  it('bands health like the MM3 gems: green, yellow, red', () => {
    expect(chroniclesHealthBand(10, 10)).toBe('healthy');
    expect(chroniclesHealthBand(9, 10)).toBe('hurt');
    expect(chroniclesHealthBand(5.1, 10)).toBe('hurt');
    expect(chroniclesHealthBand(5, 10)).toBe('critical');
    expect(chroniclesHealthBand(4, 10)).toBe('critical');
    expect(chroniclesHealthBand(2, 10)).toBe('critical');
    expect(chroniclesHealthBand(0, 0)).toBe('critical');
    expect(chroniclesHealthBand(NaN, 10)).toBe('critical');
  });


  it('shows a compact rear danger cue only for a real engaged, legally attacking archer', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const archer = chroniclesActiveEnemies(base).find(enemy => enemy.id === 'banner-road-east-scout');
    expect(archer?.ai).toMatchObject({ attackReach: 3, requiresLineOfSight: true });
    const placed = {
      ...base, x: 10, y: 3, direction: 0,
      enemyPositions: { [archer.id]: { x: 10, y: 5 } },
    };
    const fight = chroniclesStartInitiativeCombat(placed, [archer], {
      forceEnemyIds: [archer.id], random: () => 0,
    });
    expect(chroniclesEnemyAttackTarget(fight, archer)).toBeTruthy();
    expect(chroniclesThreatBearing(fight, archer)).toBe('rear');
    const html = renderToStaticMarkup(<ChroniclesCombatRoster state={fight} />);
    expect(html).toContain('data-threat-bearing="rear"');
    expect(html).toContain('data-threat-cue="rear"');
    // The warning is visible even BEFORE expanding the mobile details.
    expect(html.split('<summary>')[1]?.split('</summary>')[0]).toContain('data-threat-cue="rear"');
    expect(html).toContain('Amenaza capaz de atacar desde atrás');
    expect(html).toContain('ESPALDA');

    // A front-facing enemy cannot generate a bogus offscreen alert.
    const front = { ...fight, direction: 2 };
    expect(chroniclesThreatBearing(front, archer)).toBeNull();
    expect(renderToStaticMarkup(<ChroniclesCombatRoster state={front} />))
      .not.toContain('data-threat-cue=');
    // Likewise, an out-of-reach enemy and a dead opponent are not threats.
    expect(chroniclesThreatBearing(fight, {
      ...archer, ai: { ...archer.ai, attackReach: 1 },
    })).toBeNull();
    expect(chroniclesThreatBearing({ ...fight, [archer.hpKey]: 0 }, archer)).toBeNull();
    expect(chroniclesThreatBearing({ ...fight, initiative: null }, archer)).toBeNull();
    expect(chroniclesThreatBearing({ ...fight, combatRules: 'tactics' }, archer)).toBeNull();
  });

  it('lists the engaged foes only while initiative runs', () => {
    const exploring = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    expect(renderToStaticMarkup(<ChroniclesCombatRoster state={exploring} />)).toBe('');

    const deserter = chroniclesActiveEnemies(exploring).find((enemy) => enemy.id === 'banner-road-deserter');
    const rolled = chroniclesStartInitiativeCombat(
      { ...exploring, x: 11, y: 6, direction: 0 },
      [deserter],
      { forceEnemyIds: [deserter.id] },
    );
    expect(rolled.initiative).toBeTruthy();
    // Initiative is random by design: a foe can act before the party.
    // Test the target indicator on an actual hero turn instead of assuming
    // the first rolled actor is always eligible to attack.
    const heroCursor = rolled.initiative.order.findIndex(
      actor => actor.kind === 'party' && actor.id === 'knight',
    );
    expect(heroCursor).toBeGreaterThanOrEqual(0);
    const fighting = {
      ...rolled,
      initiative: { ...rolled.initiative, cursor: heroCursor },
    };
    expect(chroniclesRosterActionTarget(fighting)).toEqual({
      id: deserter.id, mode: 'melee',
    });
    const hurt = { ...fighting, [deserter.hpKey]: 1 };
    const html = renderToStaticMarkup(<ChroniclesCombatRoster state={hurt} />);
    expect(html).toContain('Combate');
    expect(html).toContain('class="chronicles-combat-roster__desktop"');
    expect(html).toContain('class="chronicles-combat-roster__desktop-header"');
    expect(html).toContain('<ol aria-label="Enemigos en combate">');
    expect(html).toContain('class="chronicles-combat-roster__compact"');
    expect(html).toContain('<summary>');
    // The captain is alive elsewhere on the road but not in this fight.
    expect(chroniclesActiveEnemies(hurt).filter((enemy) => Number(hurt[enemy.hpKey] || 0) > 0).length).toBeGreaterThan(1);
    expect(html).toContain('Combate · 1 enemigo');
    expect(html).not.toContain('Objetivo:');
    expect(html).not.toContain('Sin objetivo frontal');
    expect(html).toContain('aria-label="Enemigos en combate"');

    expect(html).toContain(deserter.name);
    expect(html).toContain('data-band="critical"');
    const freshHtml = renderToStaticMarkup(<ChroniclesCombatRoster state={fighting} />);
    expect(freshHtml).toContain('data-band="healthy"');
    const woundedHtml = renderToStaticMarkup(<ChroniclesCombatRoster state={{
      ...fighting, [deserter.hpKey]: Math.ceil(deserter.maxHp * 0.75),
    }} />);
    expect(woundedHtml).toContain('data-band="hurt"');
    expect(html).toContain('data-target="true"');
    // Minimap can remain mounted for short/mobile layouts. Desktop CSS gives
    // the same grid slot to the always-expanded enemy roster during combat.
    const together = renderToStaticMarkup(
      <>
        <ChroniclesMinimap state={hurt} visitedCells={[]} />
        <ChroniclesCombatRoster state={hurt} />
      </>,
    );
    expect(together).toContain('data-chronicles-minimap="visible"');
    expect(together).toContain('class="chronicles-combat-roster"');

  });
});

describe('MM3 combat roster uses the attack reducer target, not camera direction', () => {
  it('marks a real offscreen roadside marauder as A-targetable and the click consumes Faust\'s action', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const all = chroniclesActiveEnemies(base);
    const marauder = all.find(enemy => enemy.id === 'banner-road-north-marauder');
    expect(marauder?.name).toBe('salteador de la calzada');
    const placed = {
      ...base, x: 5, y: 2, direction: 0,
      ...Object.fromEntries(all.filter(enemy => enemy.id !== marauder.id)
        .map(enemy => [enemy.hpKey, 0])),
      enemyPositions: { [marauder.id]: { x: 5, y: 3 } },
    };
    const fight = chroniclesStartInitiativeCombat(placed, [marauder], { random: () => 0 });
    expect(fight.phase).toBe('combat');
    const cursor = fight.initiative.order.findIndex(actor =>
      actor.kind === 'party' && actor.id === 'knight');
    expect(cursor).toBeGreaterThanOrEqual(0);
    // Old checkpoints can preserve their locked north-facing viewpoint;
    // this is legal, even though the attacker is one cell to the south.
    const offscreen = { ...fight, direction: 0,
      initiative: { ...fight.initiative, cursor } };
    expect(chroniclesEnemyTargetAhead(offscreen, 3)).toBeNull();
    expect(chroniclesRosterActionTarget(offscreen)).toEqual({
      id: marauder.id, mode: 'melee',
    });
    const html = renderToStaticMarkup(<ChroniclesCombatRoster state={offscreen} />);
    expect(html).toContain('data-target="true"');
    expect(html).toContain('data-chronicles-target-mode="melee"');
    expect(html).toContain('A · AL ALCANCE');
    const hit = chroniclesReduce(offscreen, {
      type: 'attack', memberId: 'knight', mode: 'melee',
    });
    expect(hit.turns).toBe(offscreen.turns + 1);
    expect(hit.direction).toBe(offscreen.direction);
  });

  it('never marks a phantom attack target during the enemy initiative slot', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const enemy = chroniclesActiveEnemies(base).find(e => e.id === 'banner-road-north-marauder');
    const fight = chroniclesStartInitiativeCombat({
      ...base, x: 5, y: 2, direction: 2,
      enemyPositions: { [enemy.id]: { x: 5, y: 3 } },
    }, [enemy], { forceEnemyIds: [enemy.id], random: () => 0 });
    const index = fight.initiative.order.findIndex(actor => actor.kind === 'enemy');
    const enemyTurn = { ...fight, initiative: { ...fight.initiative, cursor: index } };
    expect(chroniclesRosterActionTarget(enemyTurn)).toBeNull();
    expect(renderToStaticMarkup(<ChroniclesCombatRoster state={enemyTurn} />))
      .not.toContain('data-chronicles-target-mode=');
  });
});
