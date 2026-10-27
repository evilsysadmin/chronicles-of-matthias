import { describe, expect, it, vi } from 'vitest';
import { createChroniclesFrameScheduler } from './chroniclesFrameScheduler.js';

function harness() {
  let time = 0;
  let nextId = 1;
  const pending = new Map();
  const draw = vi.fn();
  const cancelFrame = vi.fn((id) => pending.delete(id));
  const scheduler = createChroniclesFrameScheduler({
    requestFrame: (callback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancelFrame,
    now: () => time,
    draw,
  });
  return {
    scheduler, draw, cancelFrame,
    pending: () => pending.size,
    step(at) {
      time = at;
      const [id, callback] = pending.entries().next().value || [];
      if (!callback) throw new Error('No pending frame');
      pending.delete(id);
      callback();
    },
  };
}

describe('Chronicles on-demand 3D frame scheduler', () => {
  it('paints once on static changes and schedules nothing while idle', () => {
    const h = harness();
    h.scheduler.invalidate();
    h.scheduler.invalidate();
    expect(h.pending()).toBe(1);
    h.step(16);
    expect(h.draw).toHaveBeenCalledExactlyOnceWith(true);
    expect(h.pending()).toBe(0);
  });

  it('finishes a movement burst and then goes idle', () => {
    const h = harness();
    h.scheduler.invalidate(100);
    h.step(16);
    expect(h.draw).toHaveBeenLastCalledWith(false);
    expect(h.pending()).toBe(1);
    h.step(110);
    expect(h.draw).toHaveBeenLastCalledWith(true);
    expect(h.pending()).toBe(0);
  });

  it('extends overlapping action bursts without duplicate RAF loops', () => {
    const h = harness();
    h.scheduler.invalidate(100);
    h.step(60);
    h.scheduler.invalidate(100);
    expect(h.pending()).toBe(1);
    h.step(110);
    expect(h.pending()).toBe(1);
    h.step(170);
    expect(h.pending()).toBe(0);
  });

  it('cancels animation when hidden and repaints once after visibility returns', () => {
    const h = harness();
    h.scheduler.invalidate(1000);
    h.scheduler.setVisible(false);
    expect(h.pending()).toBe(0);
    expect(h.cancelFrame).toHaveBeenCalledTimes(1);
    h.scheduler.invalidate(1000);
    expect(h.pending()).toBe(0);
    h.scheduler.setVisible(true);
    expect(h.pending()).toBe(1);
    h.step(100);
    expect(h.draw).toHaveBeenCalledExactlyOnceWith(true);
    expect(h.pending()).toBe(0);
  });

  it('never requests frames after disposal', () => {
    const h = harness();
    h.scheduler.invalidate(1000);
    h.scheduler.dispose();
    expect(h.pending()).toBe(0);
    h.scheduler.invalidate();
    h.scheduler.setVisible(false);
    h.scheduler.setVisible(true);
    expect(h.pending()).toBe(0);
    expect(h.draw).not.toHaveBeenCalled();
  });
});
