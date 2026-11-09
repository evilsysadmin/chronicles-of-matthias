import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesPartyArmorClass, chroniclesPartyAttackStats,
  chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesFatigueStatus, CHRONICLES_FATIGUE_THRESHOLD_MINUTES } from './chroniclesFatigue.js';
import { chroniclesPartyInitiativeAgility, chroniclesRollInitiative } from './chroniclesInitiative.js';
import { chroniclesAdvanceWorldTimeOnTurn } from './chroniclesWorldTime.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const original = () => createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
const awake = (state, minutes) => ({ ...state, worldMinutes: state.lastRestWorldMinutes + minutes });
const cleared = (state) => ({
  ...state,
  ...Object.fromEntries(chroniclesActiveEnemies(state).map((enemy) => [enemy.hpKey, 0])),
});

describe('MM3 fatigue after 16 Terra-hours without sleep', () => {
  it('uses the persistent clock at the precise threshold without wall time, and ignores Tactics', () => {
    const fresh = original();
    expect(fresh.lastRestWorldMinutes).toBe(fresh.worldMinutes);
    expect(CHRONICLES_FATIGUE_THRESHOLD_MINUTES).toBe(960);
    expect(chroniclesFatigueStatus(awake(fresh, 959))).toMatchObject({
      tired: false, awakeMinutes: 959, initiativePenalty: 0, attackPenalty: 0,
    });
    expect(chroniclesFatigueStatus(awake(fresh, 960))).toMatchObject({
      tired: true, awakeMinutes: 960, initiativePenalty: 2,
      attackPenalty: 1, armorClassPenalty: 1,
    });
    expect(chroniclesFatigueStatus(awake(fresh, 24 * 60)).tired).toBe(true);
    expect(chroniclesFatigueStatus({ ...fresh, combatRules: undefined, worldMinutes: 99999 }).tired).toBe(false);
  });

  it('penalizes effective hit chance, AC, and AGI+1d8, never permanently editing stats', () => {
    const fresh = original();
    const tired = awake(fresh, 960);
    const hero = fresh.party.find((m) => m.id === 'matthias');
    const before = JSON.stringify(hero);
    const precise = chroniclesPartyAttackStats(fresh, hero.id, 'melee');
    const worn = chroniclesPartyAttackStats(tired, hero.id, 'melee');
    expect(worn.toHit).toBe(precise.toHit - 1);
    // Configure enough speed to prove the armor modifier is really applied
    // instead of disappearing inside the zero AC floor.
    const equipped = {
      ...fresh,
      party: fresh.party.map((m) => m.id === hero.id
        ? { ...m, mm3: { ...m.mm3, bonuses: { ...m.mm3.bonuses, speed: 3 } } } : m),
    };
    expect(chroniclesPartyArmorClass(awake(equipped, 960), hero.id))
      .toBe(chroniclesPartyArmorClass(equipped, hero.id) - 1);
    const regular = chroniclesPartyInitiativeAgility(fresh, hero);
    const exhausted = chroniclesPartyInitiativeAgility(tired, hero);
    expect(exhausted).toBe(Math.max(0, regular - 2));
    const roll = chroniclesRollInitiative(tired, [], { random: () => 0 });
    expect(roll.order.find((actor) => actor.id === hero.id).initiative).toBe(exhausted + 1);
    expect(JSON.stringify(hero)).toBe(before);
    expect(chroniclesPartyInitiativeAgility({ ...fresh, combatRules: undefined }, hero))
      .toBe(regular);
  });

  it('fully resting resets fatigue while refused camping never grants free recovery', () => {
    const tired = cleared(awake(original(), 960));
    const noFood = chroniclesReduce(tired, 'camp-rest');
    expect(noFood).toBe(tired);
    expect(chroniclesFatigueStatus(noFood).tired).toBe(true);
    const supplied = {
      ...tired, inventory: {
        ...tired.inventory, 'road-rations': { id: 'road-rations', quantity: 4 },
      },
    };
    expect(chroniclesCampRestStatus(supplied, []).canRest).toBe(true);
    const rested = chroniclesReduce(supplied, 'camp-rest');
    expect(rested.worldMinutes).toBe(tired.worldMinutes + 480);
    expect(rested.lastRestWorldMinutes).toBe(rested.worldMinutes);
    expect(chroniclesFatigueStatus(rested).tired).toBe(false);
    const later = awake(rested, 960);
    expect(chroniclesFatigueStatus(later).tired).toBe(true);
  });

  it('a partial ambush never counts as completed sleep; an inn rest does', () => {
    const tired = awake(original(), 960);
    const ambush = chroniclesAdvanceWorldTimeOnTurn(tired, {
      ...tired, turns: tired.turns + 1,
      worldMinutes: tired.worldMinutes + 180,
      initiative: { order: [{ kind: 'enemy', id: 'ambusher' }], cursor: 0 },
    }, 'camp-rest');
    expect(ambush.lastRestWorldMinutes).toBe(tired.lastRestWorldMinutes);
    expect(chroniclesFatigueStatus(ambush).tired).toBe(true);
    const inn = chroniclesAdvanceWorldTimeOnTurn(tired, { ...tired, turns: tired.turns + 1 }, 'inn-rest');
    expect(inn.worldMinutes).toBe(tired.worldMinutes + 480);
    expect(inn.lastRestWorldMinutes).toBe(inn.worldMinutes);
    expect(chroniclesFatigueStatus(inn).tired).toBe(false);
  });

  it('round-trips F5/Go checkpoints and handles legacy or corrupted receipts safely', () => {
    const tired = awake(original(), 960);
    const saved = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(tired, 1)));
    expect(saved.worldFlags['__chrRuntime.lastRestWorldMinutes']).toBe(tired.lastRestWorldMinutes);
    const restored = chroniclesApplyRunCheckpoint(original(), saved);
    expect(restored.worldMinutes).toBe(tired.worldMinutes);
    expect(chroniclesFatigueStatus(restored).tired).toBe(true);
    const legacy = JSON.parse(JSON.stringify(saved));
    delete legacy.worldFlags['__chrRuntime.lastRestWorldMinutes'];
    const recovered = chroniclesApplyRunCheckpoint(original(), legacy);
    expect(recovered.lastRestWorldMinutes).toBe(recovered.worldMinutes);
    expect(chroniclesFatigueStatus(recovered).tired).toBe(false);
    for (const bad of [true, [], 'oops', -2, tired.worldMinutes + 1]) {
      const corrupt = JSON.parse(JSON.stringify(saved));
      corrupt.worldFlags['__chrRuntime.lastRestWorldMinutes'] = bad;
      expect(chroniclesFatigueStatus(chroniclesApplyRunCheckpoint(original(), corrupt)).tired).toBe(false);
    }
  });
});
