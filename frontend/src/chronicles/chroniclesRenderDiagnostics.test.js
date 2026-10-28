import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  chroniclesRenderDiagnosticsEnabled,
  createChroniclesRenderDiagnostics,
} from './chroniclesRenderDiagnostics.js';

afterEach(() => vi.unstubAllGlobals());

function harness(enabled = true) {
  let time = 0;
  let nextId = 1;
  const pending = new Map();
  const cancel = vi.fn((id) => { pending.delete(id); });
  const element = {
    className: '', hidden: false, textContent: '',
    style: { cssText: '' },
    setAttribute: vi.fn(), remove: vi.fn(),
  };
  const appendChild = vi.fn();
  const createElement = vi.fn(() => element);
  vi.stubGlobal('document', { createElement });
  const schedule = vi.fn((callback, delay) => {
    const id = nextId++;
    pending.set(id, { callback, delay });
    return id;
  });
  const meter = createChroniclesRenderDiagnostics({ appendChild }, {
    enabled, now: () => time, schedule, cancel,
  });
  return {
    meter, element, createElement, appendChild, schedule, cancel,
    pending: () => pending.size,
    setTime: (value) => { time = value; },
    sample() {
      const [id, entry] = pending.entries().next().value || [];
      if (!entry) throw Error('No pending WebGL sample');
      pending.delete(id);
      entry.callback();
    },
  };
}

describe('Chronicles opt-in local render diagnostics', () => {
  it('only activates with an explicit URL flag', () => {
    expect(chroniclesRenderDiagnosticsEnabled('?chroniclesPerf=1')).toBe(true);
    expect(chroniclesRenderDiagnosticsEnabled('?map=1&chroniclesPerf=1')).toBe(true);
    expect(chroniclesRenderDiagnosticsEnabled('?chroniclesPerf=0')).toBe(false);
    expect(chroniclesRenderDiagnosticsEnabled('?x=1')).toBe(false);
    expect(chroniclesRenderDiagnosticsEnabled('')).toBe(false);
  });

  it('does not create elements, timers or work for normal gameplay', () => {
    const h = harness(false);
    h.meter.recordFrame();
    h.meter.setVisible(false);
    h.meter.dispose();
    expect(h.createElement).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.appendChild).not.toHaveBeenCalled();
  });

  it('reports actual WebGL calls, then stops sampling completely in idle', () => {
    const h = harness();
    expect(h.schedule).toHaveBeenCalledOnce();
    expect(h.appendChild).toHaveBeenCalledWith(h.element);
    expect(h.element.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
    h.meter.recordFrame();
    h.meter.recordFrame();
    h.setTime(1000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 2 FPS · 2 frames · activo');
    expect(h.pending()).toBe(1);
    h.setTime(2000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 0 FPS · 2 frames · en reposo');
    expect(h.pending()).toBe(0);
    expect(h.schedule).toHaveBeenCalledTimes(2);
    h.setTime(20_000);
    expect(h.pending()).toBe(0); // no one-second DOM or timer churn in idle
    h.meter.dispose();
    expect(h.element.remove).toHaveBeenCalledOnce();
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it('automatically wakes its sample clock when an idle scene renders again', () => {
    const h = harness();
    h.setTime(1000);
    h.sample();
    expect(h.pending()).toBe(0);
    expect(h.element.textContent).toContain('WebGL: 0 FPS');
    h.setTime(11_000);
    h.meter.recordFrame();
    expect(h.pending()).toBe(1);
    expect(h.schedule).toHaveBeenCalledTimes(2);
    h.setTime(12_000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 1 FPS · 1 frames · activo');
    h.setTime(13_000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 0 FPS · 1 frames · en reposo');
    expect(h.pending()).toBe(0);
    h.meter.dispose();
  });

  it('pauses sampling while hidden and resumes once when tab returns', () => {
    const h = harness();
    h.meter.recordFrame();
    h.meter.setVisible(false);
    expect(h.cancel).toHaveBeenCalledOnce();
    expect(h.pending()).toBe(0);
    expect(h.element.hidden).toBe(true);
    h.meter.recordFrame();
    h.setTime(5000);
    h.meter.setVisible(true);
    expect(h.element.hidden).toBe(false);
    expect(h.schedule).toHaveBeenCalledTimes(2);
    h.setTime(6000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 0 FPS · 1 frames · en reposo');
    expect(h.pending()).toBe(0);
    h.meter.setVisible(true); // repeated visibility events must not wake idle
    expect(h.pending()).toBe(0);
    h.meter.dispose();
    h.meter.dispose();
    expect(h.cancel).toHaveBeenCalledOnce();
    h.meter.recordFrame();
    expect(h.pending()).toBe(0);
  });

  it('cancels exactly one outstanding timer on disposal', () => {
    const h = harness();
    expect(h.pending()).toBe(1);
    h.meter.dispose();
    expect(h.pending()).toBe(0);
    expect(h.cancel).toHaveBeenCalledOnce();
    h.meter.recordFrame();
    expect(h.schedule).toHaveBeenCalledOnce();
  });
});
