import { describe, expect, it, vi } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import {
  CHRONICLES_AMBIENT_REAL_BLOCK_MS, CHRONICLES_AMBIENT_WORLD_MINUTES,
  chroniclesAdvanceAmbientWorldTime, createChroniclesAmbientTimeCounter,
  attachChroniclesAmbientWorldClock,
} from './chroniclesAmbientWorldClock.js';
import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';
import { chroniclesFatigueStatus } from './chroniclesFatigue.js';

const town = { id: 'swordhaven-first-book', regionKind: 'settlement' };
const wild = { id: 'terra-b2', regionKind: 'wilderness' };
const sewer = { id: 'swordhaven-sewers', regionKind: 'dungeon' };
const start = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });

function fakeTime() {
  let at = 0, id = 0;
  const tasks = new Map(), listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener: vi.fn((key, fn) => listeners.set(key, fn)),
    removeEventListener: vi.fn((key) => listeners.delete(key)),
  };
  const timer = {
    setTimeout: vi.fn((fn, delay) => {
      const key = ++id;
      tasks.set(key, { fn, due: at + delay });
      return key;
    }),
    clearTimeout: vi.fn(key => tasks.delete(key)),
  };
  return {
    doc, timer, tasks, listeners, now: () => at,
    step(ms) {
      const until = at + ms;
      while (true) {
        const next = [...tasks.entries()].sort((a,b) => a[1].due - b[1].due)
          .find(([, task]) => task.due <= until);
        if (!next) break;
        at = next[1].due;
        tasks.delete(next[0]);
        next[1].fn();
      }
      at = until;
    },
    hide() { doc.visibilityState = 'hidden'; listeners.get('visibilitychange')(); },
    show() { doc.visibilityState = 'visible'; listeners.get('visibilitychange')(); },
  };
}
describe('Terra ambient clock: one active real minute earns two Terra minutes', () => {
  it('counts stationary minutes across movement and preserves partial progress across overlays', () => {
    const clock = fakeTime(), counter = createChroniclesAmbientTimeCounter();
    let state = start();
    const tick = vi.fn(minutes => {
      const next = chroniclesAdvanceAmbientWorldTime(state, town, minutes);
      if (next === state) return false;
      state = next;
      return true;
    });
    let detach = attachChroniclesAmbientWorldClock(tick, { ...clock, counter });
    expect(CHRONICLES_AMBIENT_REAL_BLOCK_MS).toBe(60000);
    expect(CHRONICLES_AMBIENT_WORLD_MINUTES).toBe(2);
    clock.step(30000); // still standing, under the first minute
    expect(tick).not.toHaveBeenCalled();
    const moved = { ...state, x: state.x + 1, turns: state.turns + 1, worldMinutes: state.worldMinutes + 10 };
    state = moved;
    clock.step(90000); // now 2 active minutes, including the time before moving
    expect(tick).toHaveBeenCalledTimes(2);
    expect(tick).toHaveBeenNthCalledWith(1, 2);
    expect(state.worldMinutes).toBe(moved.worldMinutes + 4);
    expect(state.turns).toBe(moved.turns);
    expect(state.x).toBe(moved.x);
    clock.step(30000);
    detach(); // open a menu; keep the elapsed half-minute
    expect(counter.getRemainderMs()).toBe(30000);
    expect(counter.msUntilNextBlock()).toBe(30000);
    clock.step(600000); // paused: no new fatigue
    detach = attachChroniclesAmbientWorldClock(tick, { ...clock, counter });
    clock.step(30000);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(state.worldMinutes).toBe(moved.worldMinutes + 6);
    detach();
  });

  it('banks multiple delayed threshold credits while retaining excess minutes', () => {
    const counter = createChroniclesAmbientTimeCounter();
    expect(counter.accrue(90000)).toBe(2);
    expect(counter.getRemainderMs()).toBe(30000);
    expect(counter.claimWorldMinutes()).toBe(2);
    expect(counter.accrue(150000)).toBe(6);
    expect(counter.getRemainderMs()).toBe(0);
    expect(counter.claimWorldMinutes()).toBe(6);
    expect(counter.claimWorldMinutes()).toBe(0);
    expect(counter.accrue(NaN)).toBe(0);
    counter.reset();
    expect(counter.msUntilNextBlock()).toBe(60000);
  });

  it('does not move enemies or spend turns, but counts exploration in caves, never combat or Tactics', () => {
    const before = start();
    const after = chroniclesAdvanceAmbientWorldTime(before, town);
    expect(after.worldMinutes).toBe(before.worldMinutes + 2);
    expect(after.turns).toBe(before.turns);
    expect(after.x).toBe(before.x);
    expect(after.direction).toBe(before.direction);
    expect(after.party).toBe(before.party);
    expect(chroniclesReduce(after, 'turn-left').worldMinutes).toBe(after.worldMinutes);
    expect(chroniclesAdvanceAmbientWorldTime(before, sewer).worldMinutes).toBe(before.worldMinutes + 2);
    expect(chroniclesAdvanceAmbientWorldTime(before, null)).toBe(before);
    expect(chroniclesAdvanceAmbientWorldTime(before, wild).worldMinutes).toBe(before.worldMinutes + 2);
    expect(chroniclesAdvanceAmbientWorldTime({ ...before, initiative: {} }, town).worldMinutes).toBe(before.worldMinutes);
    expect(chroniclesAdvanceAmbientWorldTime({ ...before, phase: 'defeated' }, town).worldMinutes).toBe(before.worldMinutes);
    expect(chroniclesAdvanceAmbientWorldTime(createChroniclesState('swordhaven-sewers'), town).combatRules).not.toBe('mm3');
    expect(chroniclesAdvanceAmbientWorldTime(before, town, -1)).toBe(before);
    const prev = chroniclesRegionalWeather({ mapId: town.id, regionKind: town.regionKind, worldMinutes: 710 });
    const next = chroniclesRegionalWeather({ mapId: town.id, regionKind: town.regionKind, worldMinutes: 720 });
    expect(next.period).toBe(prev.period+1);
  });

  it('suspends in hidden tabs and overlays, without catch-up or losing the fraction', () => {
    const clock = fakeTime(), counter = createChroniclesAmbientTimeCounter(), onTick = vi.fn(() => true);
    let close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    clock.step(30000);
    clock.hide();
    expect(clock.tasks.size).toBe(0);
    expect(counter.getRemainderMs()).toBe(30000);
    clock.step(3600000); // one hour hidden: zero elapsed credit
    clock.show();
    clock.step(15000);
    close(); // menu pauses but preserves previous 45 seconds
    expect(counter.getRemainderMs()).toBe(45000);
    clock.step(900000);
    close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    clock.step(15000);
    expect(onTick).toHaveBeenCalledOnce();
    expect(counter.getRemainderMs()).toBe(0);
    close();
    close();
    expect(clock.listeners.size).toBe(0);
    expect(clock.tasks.size).toBe(0);
  });

  it('makes a completely stationary party tired after exactly 16 Terra hours', () => {
    const clock = fakeTime();
    let state = start();
    const before = state;
    const close = attachChroniclesAmbientWorldClock((minutes) => {
      state = chroniclesAdvanceAmbientWorldTime(state, town, minutes);
      return true;
    }, clock);
    clock.step(479 * 60000); // 15 h 58 min Terra, no movements or turns
    expect(chroniclesFatigueStatus(state)).toMatchObject({
      tired: false, awakeMinutes: 958, initiativePenalty: 0,
    });
    clock.step(60000);
    expect(chroniclesFatigueStatus(state)).toMatchObject({
      tired: true, awakeMinutes: 960, attackPenalty: 1,
      armorClassPenalty: 1, initiativePenalty: 2,
    });
    expect(state.x).toBe(before.x);
    expect(state.y).toBe(before.y);
    expect(state.turns).toBe(before.turns);
    expect(state.lastRestWorldMinutes).toBe(before.lastRestWorldMinutes);
    close();
  });

  it('also accrues time when standing still in a dungeon, without triggering a turn', () => {
    const clock = fakeTime();
    let state = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
    const first = state;
    const close = attachChroniclesAmbientWorldClock((minutes) => {
      const next = chroniclesAdvanceAmbientWorldTime(state, sewer, minutes);
      if (next === state) return false;
      state = next;
      return true;
    }, clock);
    clock.step(60000);
    expect(state.worldMinutes).toBe(first.worldMinutes + 2);
    expect(chroniclesFatigueStatus(state).awakeMinutes).toBe(2);
    expect(state.turns).toBe(first.turns);
    close();
  });

  it('keeps unpaid credit for the next eligible outdoor session', () => {
    const clock = fakeTime(), counter = createChroniclesAmbientTimeCounter();
    const onTick = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    let close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    clock.step(60000);
    expect(counter.getPendingWorldMinutes()).toBe(2);
    close();
    close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(counter.getPendingWorldMinutes()).toBe(0);
    close();
  });
});
