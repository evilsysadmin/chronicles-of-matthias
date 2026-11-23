import { getChroniclesAudioVolumes, setChroniclesAudioVolume } from './chroniclesVolumePreferences.js';

// Persist both sliders with the authenticated Chronicles account, not just
// in a global browser key accidentally shared across user logins.
export const getChroniclesFxVolume = () => getChroniclesAudioVolumes().fx;
export const setChroniclesFxVolume = (value) => setChroniclesAudioVolume('fx', value);
