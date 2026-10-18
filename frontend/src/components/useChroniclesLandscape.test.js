import { describe, expect, it, vi } from 'vitest';
import {
  releaseChroniclesLandscape,
  requestChroniclesLandscapeOnEntry,
  shouldAutoRotateChroniclesOnEntry,
  shouldRelockChroniclesOnTap,
  shouldRestoreChroniclesLandscapeOnResume,
} from './useChroniclesLandscape.js';

describe('Chronicles immersive entry', () => {
  it('targets phone-like coarse-pointer viewports only', () => {
    const mobile = { innerWidth: 390, matchMedia: vi.fn(() => ({ matches: true })) };
    const desktop = { innerWidth: 1440, matchMedia: vi.fn(() => ({ matches: false })) };
    const wideTouch = { innerWidth: 1024, matchMedia: vi.fn(() => ({ matches: true })) };

    expect(shouldAutoRotateChroniclesOnEntry({ win: mobile })).toBe(true);
    expect(shouldAutoRotateChroniclesOnEntry({ win: desktop })).toBe(false);
    expect(shouldAutoRotateChroniclesOnEntry({ win: wideTouch })).toBe(false);
  });

  it('relocks only a resumed portrait phone with an existing fullscreen session', () => {
    let landscape = false;
    const win = {
      innerWidth: 390,
      matchMedia: vi.fn((query) => ({
        matches: query.includes('orientation: landscape') ? landscape : true,
      })),
    };
    const doc = { visibilityState: 'visible', fullscreenElement: {} };
    const lock = vi.fn(async () => {});
    const screenApi = { orientation: { lock } };
    const options = { win, doc, screenApi };

    expect(shouldRestoreChroniclesLandscapeOnResume(options)).toBe(true);
    landscape = true;
    expect(shouldRestoreChroniclesLandscapeOnResume(options)).toBe(false);
    landscape = false;
    doc.visibilityState = 'hidden';
    expect(shouldRestoreChroniclesLandscapeOnResume(options)).toBe(false);
    doc.visibilityState = 'visible';
    doc.fullscreenElement = null;
    expect(shouldRestoreChroniclesLandscapeOnResume(options)).toBe(false);
    doc.fullscreenElement = {};
    expect(shouldRestoreChroniclesLandscapeOnResume({ ...options, screenApi: {} })).toBe(false);
    expect(shouldRestoreChroniclesLandscapeOnResume({
      ...options, win: { ...win, innerWidth: 1440 },
    })).toBe(false);
  });

  it('uses viewport-owned immersion on desktop without requesting browser fullscreen', async () => {
    const requestFullscreen = vi.fn(async () => {});
    const lock = vi.fn();
    const win = { innerWidth: 1440, matchMedia: vi.fn(() => ({ matches: false })) };
    const doc = { documentElement: { requestFullscreen }, fullscreenElement: null };
    const screenApi = { orientation: { lock } };

    await expect(requestChroniclesLandscapeOnEntry({ win, doc, screenApi })).resolves.toEqual({
      requested: false, fullscreen: false, landscape: false,
    });
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it('requests fullscreen then landscape on a mobile entry gesture', async () => {
    const root = {};
    const doc = { documentElement: root, fullscreenElement: null, exitFullscreen: vi.fn(async () => {}) };
    const requestFullscreen = vi.fn(async () => { doc.fullscreenElement = root; });
    root.requestFullscreen = requestFullscreen;
    const lock = vi.fn(async () => {});
    const unlock = vi.fn();
    const win = { innerWidth: 390, matchMedia: vi.fn(() => ({ matches: true })) };
    const screenApi = { orientation: { lock, unlock } };

    await expect(requestChroniclesLandscapeOnEntry({ win, doc, screenApi })).resolves.toEqual({
      requested: true, fullscreen: true, landscape: true,
    });
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(requestFullscreen.mock.invocationCallOrder[0]).toBeLessThan(lock.mock.invocationCallOrder[0]);
    await expect(releaseChroniclesLandscape({ doc, screenApi })).resolves.toEqual({
      unlocked: true, fullscreen: true,
    });
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
  });

  it('degrades gracefully when fullscreen is unavailable and landscape lock rejects', async () => {
    const lock = vi.fn().mockRejectedValue(new Error('fullscreen required'));
    const win = { innerWidth: 390, matchMedia: vi.fn(() => ({ matches: true })) };
    await expect(requestChroniclesLandscapeOnEntry({
      win, screenApi: { orientation: { lock } },
    })).resolves.toEqual({ requested: true, fullscreen: false, landscape: false });
  });

  it('does not exit fullscreen already owned by the browser or user', async () => {
    const root = { requestFullscreen: vi.fn() };
    const doc = { documentElement: root, fullscreenElement: root, exitFullscreen: vi.fn() };
    const win = { innerWidth: 390, matchMedia: vi.fn(() => ({ matches: true })) };
    const screenApi = { orientation: { lock: vi.fn(async () => {}), unlock: vi.fn() } };
    await expect(requestChroniclesLandscapeOnEntry({ win, doc, screenApi })).resolves.toEqual({
      requested: true, fullscreen: false, landscape: true,
    });
    await expect(releaseChroniclesLandscape({ doc, screenApi })).resolves.toEqual({
      unlocked: true, fullscreen: false,
    });
    expect(root.requestFullscreen).not.toHaveBeenCalled();
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });

  it('releases its orientation lock without exiting user-owned native fullscreen', async () => {
    const unlock = vi.fn();
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const root = {};
    const doc = { documentElement: root, fullscreenElement: root, exitFullscreen };
    const screenApi = { orientation: { unlock } };

    await expect(releaseChroniclesLandscape({ doc, screenApi })).resolves.toEqual({
      unlocked: true, fullscreen: false,
    });
    expect(unlock).toHaveBeenCalledOnce();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});

describe('Chronicles landscape after switching apps', () => {
  const setup = () => {
    let landscape = false;
    const win = {
      innerWidth: 390,
      matchMedia: vi.fn((query) => ({ matches: query.includes('orientation: landscape') ? landscape : true })),
    };
    const doc = {
      visibilityState: 'visible',
      fullscreenElement: null,
      documentElement: { requestFullscreen: vi.fn(async () => { doc.fullscreenElement = {}; }) },
      exitFullscreen: vi.fn(async () => { doc.fullscreenElement = null; }),
    };
    const screenApi = { orientation: { lock: vi.fn(async () => {}), unlock: vi.fn() } };
    return { win, doc, screenApi, rotate: (value) => { landscape = value; } };
  };

  it('asks for the next tap only after the player had chosen landscape', async () => {
    const { win, doc, screenApi } = setup();
    await releaseChroniclesLandscape({ doc, screenApi });
    expect(shouldRelockChroniclesOnTap({ win, doc })).toBe(false);
    const entry = await requestChroniclesLandscapeOnEntry({ win, doc, screenApi });
    expect(entry.landscape).toBe(true);
    // Back from another app: fullscreen is gone and the phone is upright.
    doc.fullscreenElement = null;
    expect(shouldRelockChroniclesOnTap({ win, doc })).toBe(true);
    await releaseChroniclesLandscape({ doc, screenApi });
    expect(shouldRelockChroniclesOnTap({ win, doc })).toBe(false);
  });

  it('does nothing while hidden or already in landscape', async () => {
    const { win, doc, screenApi, rotate } = setup();
    await requestChroniclesLandscapeOnEntry({ win, doc, screenApi });
    doc.visibilityState = 'hidden';
    expect(shouldRelockChroniclesOnTap({ win, doc })).toBe(false);
    doc.visibilityState = 'visible';
    rotate(true);
    expect(shouldRelockChroniclesOnTap({ win, doc })).toBe(false);
    await releaseChroniclesLandscape({ doc, screenApi });
  });
});
