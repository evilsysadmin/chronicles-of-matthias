import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHRONICLES_MUSIC_PREFERENCES_EVENT,
  getChroniclesMusicVolume,
  isChroniclesMusicMuted,
  setChroniclesMusicVolume,
} from './chroniclesMusicPreferences.js';

describe('Chronicles soundtrack preferences without the legacy radio', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('retains existing saved profile volume and legacy mute precedence', () => {
    expect(getChroniclesMusicVolume()).toBe(1);
    expect(isChroniclesMusicMuted()).toBe(false);
    localStorage.setItem('chess-study-music-volume', '0.4');
    localStorage.setItem('chess-study-muted', '1');
    expect(getChroniclesMusicVolume()).toBeCloseTo(0.4);
    expect(isChroniclesMusicMuted()).toBe(true);
    localStorage.setItem('chess-study-music-muted', '0');
    expect(isChroniclesMusicMuted()).toBe(false);
  });

  it('persists the profile preference and emits both sync and Chronicles events', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    expect(setChroniclesMusicVolume(0.35)).toBeCloseTo(0.35);
    expect(localStorage.getItem('chess-study-music-volume')).toBe('0.35');
    expect(getChroniclesMusicVolume()).toBeCloseTo(0.35);
    const emitted = dispatchEvent.mock.calls.map(([event]) => event.type);
    expect(emitted).toEqual(['chess-study-profile-changed', CHRONICLES_MUSIC_PREFERENCES_EVENT]);
    expect(emitted).not.toContain('chess-ambient-transport');
    expect(setChroniclesMusicVolume(3)).toBe(1);
    expect(setChroniclesMusicVolume(-1)).toBe(0);
  });

  it('is safe to update the profile while rendering outside the browser', () => {
    expect(setChroniclesMusicVolume(0.25)).toBeCloseTo(0.25);
    expect(getChroniclesMusicVolume()).toBeCloseTo(0.25);
  });
});
