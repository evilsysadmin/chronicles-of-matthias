import { describe, expect, it, vi } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget,
  chroniclesEnemyTargetAhead, chroniclesReduce,
} from '../../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from '../chroniclesInitiative.js';
import { ChroniclesCampaignBot, seededRandom } from './chroniclesCampaignBot.js';

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
    expect(fight.direction).toBe(1); // auto-face the adjacent captain at entry
    expect(chroniclesEnemyTargetAhead(fight, 1)?.enemy.id).toBe(captain.id);
    expect(chroniclesEnemyTargetAhead({ ...fight, direction: 0 }, 1)?.enemy.id).toBe(bystander.id);
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(captain.id);
    const action = bot.chooseCombatAction(heroId);
    expect(action).toEqual({ type: 'attack', memberId: heroId, mode: 'melee' });
    const struck = chroniclesReduce(fight, action);
    expect(struck.turns).toBe(fight.turns + 1);
    expect(struck.direction).toBe(fight.direction);
    expect(struck[bystander.hpKey]).toBe(fight[bystander.hpKey]);
  });
  it('completes the full rear-scout encounter without turning or attacking a bystander', () => {
    const { bot, fight, archer, bystander } = scenario();
    const outsiderHp = fight[bystander.hpKey];
    const actions = [];
    const act = bot.act.bind(bot);
    bot.act = (action) => {
      actions.push(typeof action === 'string' ? action : action.type);
      const next = act(action);
      // No action, including an enemy response, can rotate the MM3 camera.
      expect(next.direction).toBe(fight.direction);
      return next;
    };

    // Exercise actual initiative advancement, ranged enemy AI and damage
    // against the authored archer, not only one permitted backstep.
    const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom(1173));
    try {
      bot.fight();
    } finally {
      random.mockRestore();
    }

    expect(actions).toContain('backward');
    expect(actions).toContain('attack');
    expect(actions).not.toContain('turn-left');
    expect(actions).not.toContain('turn-right');
    expect(bot.state.phase).not.toBe('defeated');
    expect(bot.state.initiative).toBeNull();
    expect(Number(bot.state[archer.hpKey])).toBeLessThanOrEqual(0);
    expect(bot.state[bystander.hpKey]).toBe(outsiderHp);
    expect(bot.fights.at(-1).partyTurns).toBeLessThan(50);
  });

});
