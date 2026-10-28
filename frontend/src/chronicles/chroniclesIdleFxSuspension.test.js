import { describe, expect, it, vi } from 'vitest';
import {
  CHRONICLES_FX_IDLE_SUSPEND_MS,
  createChroniclesIdleFxSuspension,
  CHRONICLES_FX_ACTIVITY_EVENT,
  announceChroniclesFxActivity,
  listenForChroniclesFxActivity,
} from './chroniclesIdleFxSuspension.js';

function createHarness() {
  let nextId = 1;
  const pending = new Map();
  const schedule = vi.fn((callback, delay) => {
    const id = nextId++;
    pending.set(id, { callback, delay });
    return id;
  });
  const cancel = vi.fn((id) => pending.delete(id));
  const canSuspend = vi.fn(() => true);
  const suspend = vi.fn();
  const controller = createChroniclesIdleFxSuspension({
    schedule, cancel, canSuspend, suspend,
  });
  return {
    controller, schedule, cancel, canSuspend, suspend,
    pending: () => pending.size,
    deadlines: () => [...pending.values()].map(x => x.delay),
    fire() {
      const [id, entry] = pending.entries().next().value || [];
      if (!entry) throw Error('No idle deadline pending');
      pending.delete(id);
      entry.callback();
    },
  };
}

describe('Chronicles shared Web Audio idle parking', () => {
  it('suspends once after ten seconds without gestures, not every second', () => {
    const h = createHarness();
    h.controller.activity();
    expect(h.deadlines()).toEqual([CHRONICLES_FX_IDLE_SUSPEND_MS]);
    h.fire();
    expect(h.suspend).toHaveBeenCalledOnce();
    expect(h.pending()).toBe(0);
    h.controller.dispose();
  });

  it('resets the deadline on each gesture so combat and delayed SFX can finish', () => {
    const h = createHarness();
    h.controller.activity();
    h.controller.activity();
    h.controller.activity();
    expect(h.cancel).toHaveBeenCalledTimes(2);
    expect(h.pending()).toBe(1);
    h.fire();
    expect(h.suspend).toHaveBeenCalledOnce();
  });

  it('does not suspend if a shared audio owner is active or context is absent', () => {
    const h = createHarness();
    h.canSuspend.mockReturnValue(false);
    h.controller.activity();
    h.fire();
    expect(h.suspend).not.toHaveBeenCalled();
    h.canSuspend.mockReturnValue(true);
    h.controller.activity();
    h.fire();
    expect(h.suspend).toHaveBeenCalledOnce();
  });

  it('re-arms idle suspension for delayed SFX after an earlier suspension', () => {
    const bus = new EventTarget();
    const h = createHarness();
    const stopObservingFx = listenForChroniclesFxActivity(bus, h.controller.activity);
    h.controller.activity();
    h.fire();
    expect(h.suspend).toHaveBeenCalledOnce();
    expect(h.pending()).toBe(0);

    // Combat retaliation or a later scripted sound reawakens WebAudio; it
    // must get its own shutdown deadline even if the player never clicks.
    expect(announceChroniclesFxActivity(bus)).toBe(true);
    expect(h.pending()).toBe(1);
    expect(h.deadlines()).toEqual([CHRONICLES_FX_IDLE_SUSPEND_MS]);
    h.fire();
    expect(h.suspend).toHaveBeenCalledTimes(2);

    stopObservingFx();
    announceChroniclesFxActivity(bus);
    expect(h.pending()).toBe(0);
    h.controller.dispose();
  });

  it('broadcasts only to the subscribed Chronicle listener and disconnects cleanly', () => {
    const bus = new EventTarget();
    const h = createHarness();
    const callback = vi.fn(() => h.controller.activity());
    const stop = listenForChroniclesFxActivity(bus, callback);
    expect(CHRONICLES_FX_ACTIVITY_EVENT).toBe('chronicles-fx-audio-activity');
    expect(announceChroniclesFxActivity(bus)).toBe(true);
    expect(callback).toHaveBeenCalledOnce();
    expect(h.pending()).toBe(1);
    stop();
    expect(announceChroniclesFxActivity(bus)).toBe(true);
    expect(callback).toHaveBeenCalledOnce();
    expect(announceChroniclesFxActivity(null)).toBe(false);
    h.controller.dispose();
    expect(h.pending()).toBe(0);
  });

  it('cleans the deadline before unmount can restore the global soundtrack', () => {
    const h = createHarness();
    h.controller.activity();
    h.controller.dispose();
    expect(h.cancel).toHaveBeenCalledOnce();
    expect(h.pending()).toBe(0);
    h.controller.activity();
    expect(h.pending()).toBe(0);
    h.controller.dispose();
    expect(h.cancel).toHaveBeenCalledOnce();
    expect(h.suspend).not.toHaveBeenCalled();
  });
});
