import { describe, expect, it, vi } from 'vitest';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget, chroniclesReduce,
} from '../../chroniclesOfMatthias.js';
import { chroniclesStartInitiativeCombat } from '../chroniclesInitiative.js';
import { ChroniclesCampaignBot, seededRandom } from './chroniclesCampaignBot.js';

function scenario({ melee = true } = {}) {
  const bot = new ChroniclesCampaignBot({
    runId: 'stationary-mm3-bot', startMap: 'banner-road-first-book',
  });
  const base = bot.state;
  const all = chroniclesActiveEnemies(base);
  const archer = all.find(({ id }) => id === 'banner-road-east-scout');
  const meleeFoe = all.find(({ id }) => id === 'banner-road-deserter');
  expect(archer && meleeFoe).toBeTruthy();
  const activeIds = new Set([archer.id, meleeFoe.id]);
  const placed = {
    ...base,
    ...Object.fromEntries(all.filter((enemy) => !activeIds.has(enemy.id))
      .map((enemy) => [enemy.hpKey, 0])),
    ...(melee ? {} : { [meleeFoe.hpKey]: 0 }),
    x: 10, y: 3, direction: 2,
    enemyPositions: {
      [archer.id]: { x: 10, y: 5 },
      [meleeFoe.id]: { x: 10, y: 2 },
    },
  };
  return { bot, placed, archer, meleeFoe };
}

describe('MM3 campaign bot: melee initiative is stationary', () => {
  it('does not launch combat or take a frozen-initiative approach step toward a ranged shooter', () => {
    const { placed, archer } = scenario({ melee: false });
    const attempted = chroniclesStartInitiativeCombat(placed, [archer], {
      forceEnemyIds: [archer.id], random: () => 0,
    });
    expect(attempted).toBe(placed);
    expect(attempted.phase).toBe('explore');
    const moved = chroniclesReduce(attempted, 'forward');
    expect([moved.x, moved.y]).toEqual([10, 4]);
  });

  it('attacks an adjacent melee enemy without moving the group or rotating after contact', () => {
    const { bot, placed, meleeFoe } = scenario();
    const started = chroniclesStartInitiativeCombat(placed, [meleeFoe], { random: () => 0 });
    expect(started.phase).toBe('combat');
    expect(started.direction).toBe(0);
    const index = started.initiative.order.findIndex((actor) => actor.kind === 'party');
    const fight = { ...started, initiative: { ...started.initiative, cursor: index } };
    bot.state = fight;
    expect(chroniclesCombatMeleeTarget(fight)?.enemy.id).toBe(meleeFoe.id);
    const action = bot.chooseCombatAction(fight.initiative.order[index].id);
    expect(action).toMatchObject({ type: 'attack', mode: 'melee' });
    const struck = chroniclesReduce(fight, action);
    expect([struck.x, struck.y, struck.direction]).toEqual([10, 3, 0]);
  });

  it('finishes the real melee encounter without a single translation or turn', () => {
    const { bot, placed, archer, meleeFoe } = scenario();
    const outsiderHp = placed[archer.hpKey];
    const started = chroniclesStartInitiativeCombat(placed, [meleeFoe], { random: () => 0 });
    bot.state = started;
    const actions = [];
    const act = bot.act.bind(bot);
    bot.act = (action) => {
      const type = typeof action === 'string' ? action : action?.type;
      actions.push(type);
      const next = act(action);
      expect([next.x, next.y, next.direction]).toEqual([10, 3, 0]);
      return next;
    };
    const random = vi.spyOn(Math, 'random').mockImplementation(seededRandom(1173));
    try { bot.fight(); } finally { random.mockRestore(); }
    expect(bot.state.phase).not.toBe('defeated');
    expect(bot.state.initiative).toBeNull();
    expect(actions).toContain('attack');
    expect(actions).not.toContain('backward');
    expect(actions).not.toContain('forward');
    expect(actions).not.toContain('turn-right');
    expect(bot.state[archer.hpKey]).toBe(outsiderHp);
  });
});
