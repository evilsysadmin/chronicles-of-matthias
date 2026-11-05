import { describe, expect, it, vi } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import {
  CHRONICLES_AMBIENT_REAL_BLOCK_MS, CHRONICLES_AMBIENT_WORLD_MINUTES,
  chroniclesAdvanceAmbientWorldTime, createChroniclesAmbientTimeCounter,
  attachChroniclesAmbientWorldClock,
} from './chroniclesAmbientWorldClock.js';
import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';

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
describe('Terra ambient clock: five real minutes earn ten Terra minutes', () => {
  it('keeps a real-time remainder across steps: 3m + move + 3m = 10m and 1m banked', () => {
    const clock = fakeTime(), counter = createChroniclesAmbientTimeCounter();
    let state = start();
    const tick = vi.fn(minutes => {
      const next = chroniclesAdvanceAmbientWorldTime(state, town, minutes);
      if (next === state) return false;
      state = next;
      return true;
    });
    let detach = attachChroniclesAmbientWorldClock(tick, { ...clock, counter });
    expect(CHRONICLES_AMBIENT_REAL_BLOCK_MS).toBe(300000);
    expect(CHRONICLES_AMBIENT_WORLD_MINUTES).toBe(10);
    clock.step(180000); // stationary for 3 minutes
    expect(tick).not.toHaveBeenCalled();
    const moved = { ...state, x: state.x + 1, turns: state.turns + 1, worldMinutes: state.worldMinutes + 10 };
    state = moved;
    clock.step(180000); // 6 minutes of real exploration in total
    expect(tick).toHaveBeenCalledOnce();
    expect(tick).toHaveBeenCalledWith(10);
    expect(state.worldMinutes).toBe(moved.worldMinutes + 10);
    expect(state.turns).toBe(moved.turns);
    expect(state.x).toBe(moved.x);
    detach();
    expect(counter.getRemainderMs()).toBe(60000);
    expect(counter.msUntilNextBlock()).toBe(240000);
    detach = attachChroniclesAmbientWorldClock(tick, { ...clock, counter });
    clock.step(240000);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(state.worldMinutes).toBe(moved.worldMinutes + 20);
    detach();
  });

  it('banks multiple delayed threshold credits while retaining excess minutes', () => {
    const counter = createChroniclesAmbientTimeCounter();
    expect(counter.accrue(6*60000)).toBe(10);
    expect(counter.getRemainderMs()).toBe(60000);
    expect(counter.claimWorldMinutes()).toBe(10);
    expect(counter.accrue(11*60000)).toBe(20);
    expect(counter.getRemainderMs()).toBe(120000);
    expect(counter.claimWorldMinutes()).toBe(20);
    expect(counter.claimWorldMinutes()).toBe(0);
    expect(counter.accrue(NaN)).toBe(0);
    counter.reset();
    expect(counter.msUntilNextBlock()).toBe(300000);
  });

  it('does not move enemies, consume turns, advance in caves, combat or Tactics', () => {
    const before = start();
    const after = chroniclesAdvanceAmbientWorldTime(before, town);
    expect(after.worldMinutes).toBe(before.worldMinutes + 10);
    expect(after.turns).toBe(before.turns);
    expect(after.x).toBe(before.x);
    expect(after.direction).toBe(before.direction);
    expect(after.party).toBe(before.party);
    expect(chroniclesReduce(after, 'turn-left').worldMinutes).toBe(after.worldMinutes);
    expect(chroniclesAdvanceAmbientWorldTime(before, sewer)).toBe(before);
    expect(chroniclesAdvanceAmbientWorldTime(before, wild).worldMinutes).toBe(before.worldMinutes + 10);
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
    clock.step(180000);
    clock.hide();
    expect(clock.tasks.size).toBe(0);
    expect(counter.getRemainderMs()).toBe(180000);
    clock.step(3600000); // one hour hidden: zero elapsed credit
    clock.show();
    clock.step(60000);
    close(); // menu pauses but preserves previous 4 minutes
    expect(counter.getRemainderMs()).toBe(240000);
    clock.step(900000);
    close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    clock.step(60000);
    expect(onTick).toHaveBeenCalledOnce();
    expect(counter.getRemainderMs()).toBe(0);
    close();
    close();
    expect(clock.listeners.size).toBe(0);
    expect(clock.tasks.size).toBe(0);
  });

  it('keeps unpaid credit for the next eligible outdoor session', () => {
    const clock = fakeTime(), counter = createChroniclesAmbientTimeCounter();
    const onTick = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    let close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    clock.step(300000);
    expect(counter.getPendingWorldMinutes()).toBe(10);
    close();
    close = attachChroniclesAmbientWorldClock(onTick, { ...clock, counter });
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(counter.getPendingWorldMinutes()).toBe(0);
    close();
  });
});
