// Chronicles owns soundtrack transport. Keep the existing profile-synced
// music preference keys to preserve saved volume and mute across the split,
// without importing Chess Studio's procedural radio or its transport events.
import { isMusicMuted } from '../soundPreferences.js';
import { getChroniclesAudioVolumes, setChroniclesAudioVolume } from './chroniclesVolumePreferences.js';

export const CHRONICLES_MUSIC_PREFERENCES_EVENT = 'chronicles-music-preferences-changed';

export const getChroniclesMusicVolume = () => getChroniclesAudioVolumes().music;
export const isChroniclesMusicMuted = () => isMusicMuted();

export function setChroniclesMusicVolume(value) {
  const level = setChroniclesAudioVolume('music', value);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(CHRONICLES_MUSIC_PREFERENCES_EVENT));
  }
  return level;
}
