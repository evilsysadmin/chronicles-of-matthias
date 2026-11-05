import { describe, expect, it, vi } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import {
  CHRONICLES_AMBIENT_TICK_MS, CHRONICLES_AMBIENT_TICK_MINUTES,
  chroniclesAdvanceAmbientWorldTime, attachChroniclesAmbientWorldClock,
} from './chroniclesAmbientWorldClock.js';
import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';

const town = { id: 'swordhaven-first-book', regionKind: 'settlement' };
const wild = { id: 'terra-b2', regionKind: 'wilderness' };
const sewer = { id: 'swordhaven-sewers', regionKind: 'dungeon' };
const start = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });

describe('Terra world clock while the party stands still', () => {
  it('advances saved time, solar phase and weather without a single turn or movement', () => {
    const before = start();
    const after = chroniclesAdvanceAmbientWorldTime(before, town);
    expect(CHRONICLES_AMBIENT_TICK_MS).toBe(5000);
    expect(CHRONICLES_AMBIENT_TICK_MINUTES).toBe(5);
    expect(after.worldMinutes).toBe(before.worldMinutes + 5);
    expect(after.turns).toBe(before.turns);
    expect(after.direction).toBe(before.direction);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.party).toBe(before.party);
    const look = chroniclesReduce(after, 'turn-left');
    expect(look.worldMinutes).toBe(after.worldMinutes);
    // A stationary group can eventually see one weather block finish.
    const weatherStart = chroniclesRegionalWeather({
      mapId: town.id, regionKind: town.regionKind, worldMinutes: 480,
    });
    const waiting = chroniclesAdvanceAmbientWorldTime(
      { ...before, worldMinutes: 715 }, town,
    );
    expect(waiting.worldMinutes).toBe(720);
    const newWeather = chroniclesRegionalWeather({
      mapId: town.id, regionKind: town.regionKind, worldMinutes: waiting.worldMinutes,
    });
    expect(weatherStart?.period).not.toBe(newWeather?.period);
  });

  it('pauses outdoors when combat begins and never touches caves, Tactics or terminal runs', () => {
    const before = start();
    expect(chroniclesAdvanceAmbientWorldTime(before, sewer)).toBe(before);
    expect(chroniclesAdvanceAmbientWorldTime(before, wild).worldMinutes).toBe(485);
    expect(chroniclesAdvanceAmbientWorldTime({
      ...before, initiative: { order: [], cursor: 0 },
    }, town).worldMinutes).toBe(before.worldMinutes);
    expect(chroniclesAdvanceAmbientWorldTime({ ...before, phase: 'defeated' }, town)
      .worldMinutes).toBe(before.worldMinutes);
    const tactics = createChroniclesState('swordhaven-sewers');
    expect(chroniclesAdvanceAmbientWorldTime(tactics, town)).toBe(tactics);
    expect(chroniclesAdvanceAmbientWorldTime(null, town)).toBeNull();
    expect(chroniclesAdvanceAmbientWorldTime(before, town, -5)).toBe(before);
  });

  it('does not accumulate background time and cleans up timers on pause/unmount', () => {
    const callbacks = new Map();
    const timer = {
      setInterval: vi.fn((fn, delay) => {
        expect(delay).toBe(5000);
        callbacks.set(1, fn);
        return 1;
      }),
      clearInterval: vi.fn((id) => callbacks.delete(id)),
    };
    const listeners = new Map();
    const doc = {
      visibilityState: 'visible',
      addEventListener: vi.fn((name, fn) => listeners.set(name, fn)),
      removeEventListener: vi.fn((name) => listeners.delete(name)),
    };
    const onTick = vi.fn();
    const cleanup = attachChroniclesAmbientWorldClock(onTick, { doc, timer });
    expect(timer.setInterval).toHaveBeenCalledTimes(1);
    callbacks.get(1)();
    expect(onTick).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'hidden';
    listeners.get('visibilitychange')();
    expect(callbacks.size).toBe(0);
    expect(timer.clearInterval).toHaveBeenCalledTimes(1);
    // Resuming only schedules a future tick: NO wall-clock catch-up.
    doc.visibilityState = 'visible';
    listeners.get('visibilitychange')();
    expect(timer.setInterval).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenCalledTimes(1);
    callbacks.get(1)();
    expect(onTick).toHaveBeenCalledTimes(2);
    cleanup();
    cleanup();
    expect(callbacks.size).toBe(0);
    expect(listeners.size).toBe(0);
    expect(timer.clearInterval).toHaveBeenCalledTimes(2);
  });
});
