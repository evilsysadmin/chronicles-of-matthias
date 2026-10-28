import { useEffect, useRef } from 'react';
import { r2AssetUrl } from '../r2Assets.js';
import { unlockChroniclesActionAudio } from './chroniclesActionAudio.js';
import { getAudioContext, getAudioContextState } from '../audioContext.js';
import { createChroniclesIdleFxSuspension } from './chroniclesIdleFxSuspension.js';
import {
  getAmbientPlaybackState,
  getAmbientVolume,
  isMusicMuted,
  pauseAmbientMusic,
  startAmbientMusic,
} from '../sound.js';

const FIRST_VERSE = 'chronicles.music.firstVerse';
const SECOND_VERSE = 'chronicles.music.secondVerse';

// Character creation belongs to the expedition menu, not to the playable map.
export function chroniclesSoundtrackIdForView(entryView) {
  return entryView === 'playing' ? SECOND_VERSE : FIRST_VERSE;
}

export function chroniclesSoundtrackGain(volume, muted) {
  if (muted) return 0;
  const preference = Number(volume);
  const normalized = Number.isFinite(preference) ? Math.max(0, Math.min(1, preference)) : 1;
  return normalized * 0.72; // Leave headroom for speech and SFX.
}

// A silent HTMLAudioElement still downloads/decodes the MP3. Pausing transport
// for mute or zero volume stops that work; a later preference change or user
// gesture can restart exactly the same track and playback position.
export function syncChroniclesSoundtrackPlayback(audio, volume, muted) {
  if (!audio) return;
  const gain = chroniclesSoundtrackGain(volume, muted);
  audio.volume = gain;
  if (gain === 0) {
    if (!audio.paused) audio.pause();
    return;
  }
  if (!audio.src || !audio.paused || audio.error) return;
  const attempt = audio.play();
  if (attempt?.catch) void attempt.catch(() => {});
}

// Chronicles owns its own recorded score. The global radio retains its place
// and resumes only if it was actually playing before entering Chronicles.
export function useChroniclesSoundtrack(entryView) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const audio = new Audio();
    audio.loop = true;
    // Defer media fetch/decode until music is actually audible.
    audio.preload = 'none';
    audioRef.current = audio;

    const globalStatus = getAmbientPlaybackState()?.status;
    const restoreGlobal = globalStatus === 'playing' || globalStatus === 'gap';
    if (restoreGlobal) pauseAmbientMusic();

    // The procedural FX AudioContext is shared with the global radio. While
    // Chronicles is foregrounded, its recorded score uses HTMLAudioElement;
    // after SFX settle, park the otherwise silent shared context. Never
    // suspend while the radio is playing or create a context just to park it.
    const idleFx = createChroniclesIdleFxSuspension({
      canSuspend: () => {
        const status = getAmbientPlaybackState()?.status;
        return status !== 'playing' && status !== 'gap' && getAudioContextState() === 'running';
      },
      suspend: () => {
        try {
          const attempt = getAudioContext()?.suspend?.();
          attempt?.catch?.(() => {});
        } catch { /* Browser may refuse while transitioning. */ }
      },
    });
    idleFx.activity();

    const syncPreferences = () => {
      syncChroniclesSoundtrackPlayback(audio, getAmbientVolume(), isMusicMuted());
      // Transport/media-key controls may restart the global station while
      // Chronicles is foregrounded. Never play both soundtracks together.
      const status = getAmbientPlaybackState()?.status;
      if (status === 'playing' || status === 'gap') pauseAmbientMusic();
    };
    const retryAfterGesture = () => {
      // FX must be unlocked *during* the gesture: enemy responses and React
      // post-paint hit cues happen later, after transient activation ends.
      unlockChroniclesActionAudio();
      idleFx.activity(); // one-shot idle deadline, not a running polling loop
      // Autoplay is often blocked after F5 until the next real user gesture.
      // Do not reawaken muted media during pointer/keyboard/focus events.
      syncChroniclesSoundtrackPlayback(audio, getAmbientVolume(), isMusicMuted());
    };
    syncPreferences();
    window.addEventListener('chess-ambient-transport', syncPreferences);
    window.addEventListener('pointerdown', retryAfterGesture, { passive: true });
    window.addEventListener('keydown', retryAfterGesture);
    window.addEventListener('focus', retryAfterGesture);

    return () => {
      window.removeEventListener('chess-ambient-transport', syncPreferences);
      window.removeEventListener('pointerdown', retryAfterGesture);
      window.removeEventListener('keydown', retryAfterGesture);
      window.removeEventListener('focus', retryAfterGesture);
      idleFx.dispose(); // never park the global radio after leaving Chronicles
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (audioRef.current === audio) audioRef.current = null;
      if (restoreGlobal) startAmbientMusic();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const url = r2AssetUrl(chroniclesSoundtrackIdForView(entryView));
    if (!url) return;
    if (audio.src !== url) {
      audio.pause();
      audio.src = url;
      // play() initiates loading only when audible; no eager load for mute.
    }
    syncChroniclesSoundtrackPlayback(audio, getAmbientVolume(), isMusicMuted());
  }, [entryView]);
}
