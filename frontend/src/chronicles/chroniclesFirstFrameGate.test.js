import { describe, expect, it, vi } from 'vitest';
import { createChroniclesFirstFrameGate } from './chroniclesFirstFrameGate.js';

describe('Chronicles first 3D frame', () => {
  it('never reveals on an early uninitialized or blank frame', () => {
    const notify = vi.fn();
    const gate = createChroniclesFirstFrameGate(notify);
    expect(gate.markFrameRendered()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    gate.markStateSynchronized();
    expect(gate.markFrameRendered()).toBe(true);
    expect(notify).toHaveBeenCalledOnce();
  });
  it('notifies only once despite continuous animation frames', () => {
    const notify = vi.fn();
    const gate = createChroniclesFirstFrameGate(notify);
    gate.markStateSynchronized();
    expect(gate.markFrameRendered()).toBe(true);
    expect(gate.markFrameRendered()).toBe(false);
    expect(gate.markFrameRendered()).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
  });
});
