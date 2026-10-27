import { describe, expect, it, vi } from 'vitest';

vi.mock('../sound.js', () => ({
  getAmbientPlaybackState: () => ({ status: 'paused' }),
  getAmbientVolume: () => 1,
  isMusicMuted: () => false,
  pauseAmbientMusic: vi.fn(),
  startAmbientMusic: vi.fn(),
}));

import {
  chroniclesSoundtrackGain,
  syncChroniclesSoundtrackPlayback,
  chroniclesSoundtrackIdForView,
} from './useChroniclesSoundtrack.js';

describe('Chronicles recorded soundtrack', () => {
  it('plays the first verse in the expedition menu and character setup', () => {
    expect(chroniclesSoundtrackIdForView('menu')).toBe('chronicles.music.firstVerse');
    expect(chroniclesSoundtrackIdForView('setup')).toBe('chronicles.music.firstVerse');
  });

  it('resolves the actual manually uploaded R2 filenames, preserving their hashes', async () => {
    const { r2AssetEntry, r2AssetUrl } = await import('../r2Assets.js');
    for (const [id, basename, expectedSize] of [
      ['chronicles.music.firstVerse', 'Chronicles of matthias - First verse.mp3', 4871666],
      ['chronicles.music.secondVerse', 'Chronicles of matthias - Second verse.mp3', 4997378],
    ]) {
      const entry = r2AssetEntry(id);
      expect(entry.key).toBe(`chronicles/music/${basename}`);
      expect(entry.bytes).toBe(expectedSize);
      expect(entry.contentType).toBe('audio/mpeg');
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r2AssetUrl(id)).toContain(encodeURIComponent(basename));
    }
  });

  it('plays the second verse only during a run', () => {
    expect(chroniclesSoundtrackIdForView('playing')).toBe('chronicles.music.secondVerse');
  });

  it('obeys the existing music volume and mute without altering effects', () => {
    expect(chroniclesSoundtrackGain(1, false)).toBeCloseTo(0.72);
    expect(chroniclesSoundtrackGain(0.5, false)).toBeCloseTo(0.36);
    expect(chroniclesSoundtrackGain(0.5, true)).toBe(0);
    expect(chroniclesSoundtrackGain(-5, false)).toBe(0);
    expect(chroniclesSoundtrackGain(5, false)).toBeCloseTo(0.72);
    expect(chroniclesSoundtrackGain(Number.NaN, false)).toBeCloseTo(0.72);
  });
  
  function fakeMedia({ src = 'https://cdn.example/soundtrack.mp3', paused = true, error = null } = {}) {
    const audio = { src, paused, error, volume: 0 };
    audio.pause = vi.fn(() => { audio.paused = true; });
    audio.play = vi.fn(() => {
      audio.paused = false;
      return Promise.resolve();
    });
    return audio;
  }

  it('pauses the decoder on mute and resumes the same track when unmuted', () => {
    const audio = fakeMedia({ paused: false });
    syncChroniclesSoundtrackPlayback(audio, 1, true);
    expect(audio.volume).toBe(0);
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.play).not.toHaveBeenCalled();

    syncChroniclesSoundtrackPlayback(audio, 1, true);
    expect(audio.pause).toHaveBeenCalledOnce();
    syncChroniclesSoundtrackPlayback(audio, 0.5, false);
    expect(audio.volume).toBeCloseTo(0.36);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.src).toBe('https://cdn.example/soundtrack.mp3');

    syncChroniclesSoundtrackPlayback(audio, 1, false);
    expect(audio.play).toHaveBeenCalledOnce(); // already playing
  });

  it('pauses at zero volume and restarts after raising the slider', () => {
    const audio = fakeMedia({ paused: false });
    syncChroniclesSoundtrackPlayback(audio, 0, false);
    expect(audio.pause).toHaveBeenCalledOnce();
    syncChroniclesSoundtrackPlayback(audio, 0.3, false);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it('never retries autoplay on muted, empty-source or errored media', () => {
    const audio = fakeMedia();
    syncChroniclesSoundtrackPlayback(audio, 1, true);
    expect(audio.play).not.toHaveBeenCalled();
    audio.src = '';
    syncChroniclesSoundtrackPlayback(audio, 1, false);
    expect(audio.play).not.toHaveBeenCalled();
    audio.src = 'https://cdn.example/soundtrack.mp3';
    audio.error = { code: 4 };
    syncChroniclesSoundtrackPlayback(audio, 1, false);
    expect(audio.play).not.toHaveBeenCalled();
  });

});
