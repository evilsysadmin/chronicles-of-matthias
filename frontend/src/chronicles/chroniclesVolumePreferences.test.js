import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindProfileStorageIdentity, clearProfileCache } from '../profileKeys.js';
import { clearStorageMemoryFallback } from '../safeStorage.js';
import { getChroniclesAudioVolumes, setChroniclesAudioVolume } from './chroniclesVolumePreferences.js';

const USERNAME = 'chess-study-auth-username';
const account = (name) => 'chronicles-audio-levels-v1:' + encodeURIComponent(name);

beforeEach(() => {
  clearStorageMemoryFallback();
  localStorage.clear();
  sessionStorage.clear();
  bindProfileStorageIdentity(null);
});
afterEach(() => {
  bindProfileStorageIdentity(null);
  clearStorageMemoryFallback();
  localStorage.clear();
});

describe('Chronicles account-scoped audio levels', () => {
  it('imports pre-existing standalone music and FX once and survives profile cleanup', () => {
    localStorage.setItem(USERNAME, 'alice');
    bindProfileStorageIdentity('alice');
    localStorage.setItem('chess-study-music-volume', '0.35');
    localStorage.setItem('chronicles-fx-volume', '0.55');

    expect(getChroniclesAudioVolumes()).toEqual({ music: 0.35, fx: 0.55 });
    expect(JSON.parse(localStorage.getItem(account('alice')))).toEqual({
      music: 0.35, fx: 0.55,
    });
    clearProfileCache();
    expect(localStorage.getItem('chess-study-music-volume')).toBeNull();
    expect(getChroniclesAudioVolumes()).toEqual({ music: 0.35, fx: 0.55 });
  });

  it('does not leak audio settings between accounts on the same browser', () => {
    localStorage.setItem(USERNAME, 'Alice');
    bindProfileStorageIdentity('alice');
    setChroniclesAudioVolume('music', 0.2);
    setChroniclesAudioVolume('fx', 0.65);
    expect(getChroniclesAudioVolumes()).toEqual({ music: 0.2, fx: 0.65 });

    localStorage.setItem(USERNAME, 'Bob');
    bindProfileStorageIdentity('bob');
    expect(getChroniclesAudioVolumes()).toEqual({ music: 1, fx: 1 });
    setChroniclesAudioVolume('music', 0);
    setChroniclesAudioVolume('fx', 0);
    expect(getChroniclesAudioVolumes()).toEqual({ music: 0, fx: 0 });

    localStorage.setItem(USERNAME, 'ALICE');
    bindProfileStorageIdentity('alice');
    expect(getChroniclesAudioVolumes()).toEqual({ music: 0.2, fx: 0.65 });
  });

  it('rejects stale-tab writes when another account has logged in', () => {
    localStorage.setItem(USERNAME, 'alice');
    bindProfileStorageIdentity('alice');
    setChroniclesAudioVolume('music', 0.3);
    setChroniclesAudioVolume('fx', 0.4);
    const previous = localStorage.getItem(account('alice'));
    const oldFx = localStorage.getItem('chronicles-fx-volume');

    localStorage.setItem(USERNAME, 'bob');
    setChroniclesAudioVolume('music', 1);
    setChroniclesAudioVolume('fx', 1);
    expect(localStorage.getItem(account('alice'))).toBe(previous);
    expect(localStorage.getItem(account('bob'))).toBeNull();
    expect(localStorage.getItem('chronicles-fx-volume')).toBe(oldFx);
    expect(getChroniclesAudioVolumes()).toEqual({ music: 1, fx: 1 });
  });

  it('repairs a corrupt account record without throwing and keeps zero volume exact', () => {
    localStorage.setItem(USERNAME, 'alice');
    bindProfileStorageIdentity('alice');
    localStorage.setItem(account('alice'), '{broken');
    expect(getChroniclesAudioVolumes()).toEqual({ music: 1, fx: 1 });
    expect(setChroniclesAudioVolume('music', -10)).toBe(0);
    expect(setChroniclesAudioVolume('fx', Number.POSITIVE_INFINITY)).toBe(1);
    expect(getChroniclesAudioVolumes()).toEqual({ music: 0, fx: 1 });
    expect(() => setChroniclesAudioVolume('invalid', 0.5)).toThrow(/Unsupported/);
  });
});
