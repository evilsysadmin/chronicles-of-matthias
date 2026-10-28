import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  chroniclesRenderDiagnosticsEnabled,
  createChroniclesRenderDiagnostics,
} from './chroniclesRenderDiagnostics.js';

afterEach(() => vi.unstubAllGlobals());

function harness(enabled = true) {
  let time = 0;
  let tick = null;
  let nextInterval = 1;
  const cancel = vi.fn();
  const element = {
    className: '', hidden: false, textContent: '',
    style: { cssText: '' },
    setAttribute: vi.fn(), remove: vi.fn(),
  };
  const appendChild = vi.fn();
  const createElement = vi.fn(() => element);
  vi.stubGlobal('document', { createElement });
  const schedule = vi.fn((callback) => {
    tick = callback;
    return nextInterval++;
  });
  const meter = createChroniclesRenderDiagnostics({ appendChild }, {
    enabled, now: () => time, schedule, cancel,
  });
  return {
    meter, element, createElement, appendChild, schedule, cancel,
    setTime: (value) => { time = value; },
    sample: () => tick?.(),
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

  it('reports real WebGL render calls, including a zero-frame idle second', () => {
    const h = harness();
    expect(h.schedule).toHaveBeenCalledOnce();
    expect(h.appendChild).toHaveBeenCalledWith(h.element);
    expect(h.element.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
    h.meter.recordFrame();
    h.meter.recordFrame();
    h.setTime(1000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 2 FPS · 2 frames · activo');
    h.setTime(2000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 0 FPS · 2 frames · en reposo');
    h.meter.dispose();
    expect(h.element.remove).toHaveBeenCalledOnce();
    expect(h.cancel).toHaveBeenCalledOnce();
  });

  it('stops its sampling timer when hidden and restores one on return', () => {
    const h = harness();
    h.meter.recordFrame();
    h.meter.setVisible(false);
    expect(h.cancel).toHaveBeenCalledOnce();
    expect(h.element.hidden).toBe(true);
    h.meter.recordFrame();
    h.setTime(5000);
    h.meter.setVisible(true);
    expect(h.element.hidden).toBe(false);
    expect(h.schedule).toHaveBeenCalledTimes(2);
    h.setTime(6000);
    h.sample();
    expect(h.element.textContent).toContain('WebGL: 0 FPS · 1 frames · en reposo');
    h.meter.dispose();
    h.meter.dispose();
    expect(h.cancel).toHaveBeenCalledTimes(2);
    h.meter.recordFrame();
    expect(h.element.textContent).toContain('WebGL: 0 FPS');
  });
});
