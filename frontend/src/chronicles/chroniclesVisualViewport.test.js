import { describe, expect, it } from 'vitest';
import { attachChroniclesVisualViewport } from './chroniclesVisualViewport.js';

function fixture() {
  const values = new Map();
  const root = {
    style: {
      setProperty: (name, value) => values.set(name, value),
      removeProperty: (name) => values.delete(name),
    },
  };
  const viewport = new EventTarget();
  viewport.height = 360.9;
  viewport.offsetTop = 0;
  return { values, root, viewport };
}

describe('Android visible viewport for the touch HUD', () => {
  it('tracks the visible height and top after rotation or mobile browser chrome changes', () => {
    const { values, root, viewport } = fixture();
    const cleanup = attachChroniclesVisualViewport(root, viewport);
    expect(values.get('--chronicles-visual-height')).toBe('360px');
    expect(values.get('--chronicles-visual-top')).toBe('0px');

    viewport.height = 312.6;
    viewport.offsetTop = 13.8;
    viewport.dispatchEvent(new Event('resize'));
    expect(values.get('--chronicles-visual-height')).toBe('312px');
    expect(values.get('--chronicles-visual-top')).toBe('13px');

    viewport.height = 304;
    viewport.dispatchEvent(new Event('scroll'));
    expect(values.get('--chronicles-visual-height')).toBe('304px');

    cleanup();
    expect(values.size).toBe(0);
    viewport.height = 100;
    viewport.dispatchEvent(new Event('resize'));
    expect(values.size).toBe(0);
  });

  it('keeps CSS viewport fallback when the visual viewport is missing or invalid', () => {
    expect(() => attachChroniclesVisualViewport(null, null)()).not.toThrow();
    const { values, root, viewport } = fixture();
    viewport.height = Number.NaN;
    const cleanup = attachChroniclesVisualViewport(root, viewport);
    expect(values.size).toBe(0);
    cleanup();
  });
});
