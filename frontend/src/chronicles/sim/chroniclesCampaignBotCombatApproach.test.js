import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget,
  chroniclesEnemyTargetAhead, chroniclesReduce,
} from '../../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from '../chroniclesInitiative.js';
import { ChroniclesCampaignBot } from './chroniclesCampaignBot.js';

function scenario({ flank = false } = {}) {
  const bot = new ChroniclesCampaignBot({
    runId: 'initiative-multi-enemy-bot', startMap: 'banner-road-first-book',
  });
  const base = bot.state;
  const all = chroniclesActiveEnemies(base);
  const byId = id => {
    const enemy = all.find(candidate => candidate.id === id);
    expect(enemy, id).toBeTruthy();
    return enemy;
  };
  const archer = byId('banner-road-east-scout');
  const captain = byId('banner-road-bandit-captain');
  const bystander = byId('banner-road-deserter');
  const kept = new Set([archer.id, captain.id, bystander.id]);
  const state = {
    ...base,
    ...Object.fromEntries(all.filter(enemy => !kept.has(enemy.id))
      .map(enemy => [enemy.hpKey, 0])),
    x: 10, y: 3, direction: 0,
    enemyPositions: {
      [archer.id]: { x: 10, y: 5 },
      [captain.id]: { x: 11, y: 3 },
      [bystander.id]: { x: 10, y: 2 },
    },
  };
  const enrolled = flank ? [archer, captain] : [archer];
  const started = chroniclesStartInitiativeCombat(state, enrolled, {
    forceEnemyIds: enrolled.map(enemy => enemy.id), random: () => 0,
  });
  expect(started.phase).toBe('combat');
  const heroIndex = started.initiative.order.findIndex(actor => actor.kind === 'party');
  expect(heroIndex).toBeGreaterThanOrEqual(0);
  const fight = {
    ...started, initiative: { ...started.initiative, cursor: heroIndex },
  };
  bot.state = fight;
  return { bot, fight, archer, captain, bystander,
    heroId: fight.initiative.order[heroIndex].id };
}

describe('MM3 campaign bot respects fixed-facing multi-enemy initiative', () => {
  it('backs toward a real engaged rear shooter instead of attacking a forward bystander', () => {
    const { bot, fight, archer, bystander, heroId } = scenario();
    expect(chroniclesEnemyTargetAhead(fight, 3)?.enemy.id).toBe(bystander.id);
    const action = bot.chooseCombatAction(heroId);
    expect(action).toBe('backward');
    const moved = chroniclesReduce(fight, action);
    expect([moved.x, moved.y, moved.direction]).toEqual([10, 4, 0]);
    expect(moved.turns).toBe(fight.turns + 1);
    expect(moved.combatActionSpent?.[heroId]).toBe(true);
    expect(chroniclesCombatMeleeTarget(moved)?.enemy.id).toBe(archer.id);
    expect(moved[bystander.hpKey]).toBe(fight[bystander.hpKey]);
  });

  it('uses melee against the engaged flank without turning or harming an outsider', () => {
    const { bot, fight, captain, bystander, heroId } = scenario({ flank: true });
    expect(chroniclesEnemyTargetAhead(fight, 1)?.enemy.id).toBe(bystander.id);
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(captain.id);
    const action = bot.chooseCombatAction(heroId);
    expect(action).toEqual({ type: 'attack', memberId: heroId, mode: 'melee' });
    const struck = chroniclesReduce(fight, action);
    expect(struck.turns).toBe(fight.turns + 1);
    expect(struck.direction).toBe(0);
    expect(struck[bystander.hpKey]).toBe(fight[bystander.hpKey]);
  });
});
