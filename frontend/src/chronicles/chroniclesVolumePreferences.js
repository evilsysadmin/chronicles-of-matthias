// Chronicles soundtrack/SFX volume is a per-account browser preference.
// Do not rely solely on the old Chess Studio profile cache: auth deliberately
// clears that cache on logout and Chronicles does not hydrate its old profile API.
// Keep this standalone from gameplay saves, SSO tokens, and session-only music.
import { profileStorageIdentityMatchesCurrentUser } from '../profileKeys.js';
import { STORAGE_LOCAL, getStorageItem, setStorageItem } from '../safeStorage.js';
import { getAmbientVolume, writeAmbientVolume } from '../soundPreferences.js';

const USERNAME_KEY = 'chess-study-auth-username';
const STORAGE_PREFIX = 'chronicles-audio-levels-v1:';
const LEGACY_IMPORTED_KEY = 'chronicles-audio-levels-legacy-imported-v1';
const LEGACY_FX_KEY = 'chronicles-fx-volume';
const DEFAULT_LEVELS = Object.freeze({ music: 1, fx: 1 });

const normalize = (value) => Math.max(0, Math.min(1,
  Number.isFinite(Number(value)) ? Number(value) : 1));

function currentOwner() {
  const username = String(getStorageItem(STORAGE_LOCAL, USERNAME_KEY) || '').trim().toLowerCase();
  return username && profileStorageIdentityMatchesCurrentUser() ? username : null;
}

function accountKey(owner) {
  return STORAGE_PREFIX + encodeURIComponent(owner);
}

function readStored(owner) {
  if (!owner) return null;
  try {
    const levels = JSON.parse(getStorageItem(STORAGE_LOCAL, accountKey(owner)) || 'null');
    if (!levels || typeof levels !== 'object') return null;
    const valid = (value) => typeof value === 'number' && Number.isFinite(value)
      && value >= 0 && value <= 1;
    return valid(levels.music) && valid(levels.fx)
      ? { music: levels.music, fx: levels.fx } : null;
  } catch {
    return null;
  }
}

function readLegacy() {
  const fx = getStorageItem(STORAGE_LOCAL, LEGACY_FX_KEY);
  return {
    music: getAmbientVolume(),
    fx: fx === null ? 1 : normalize(fx),
  };
}

export function getChroniclesAudioVolumes() {
  const owner = currentOwner();
  if (!owner) {
    // Anonymous login screens have no soundtrack; do not create account
    // settings for a stale tab after another tab changes the logged-in user.
    return getStorageItem(STORAGE_LOCAL, USERNAME_KEY) ? DEFAULT_LEVELS : readLegacy();
  }
  const saved = readStored(owner);
  if (saved) return saved;

  // One-time import of EXISTING volume choices from the older standalone
  // slider. Subsequent accounts start at defaults, never inheriting another
  // user's music/SFX volume. The marker survives logout like the account key.
  const firstImport = getStorageItem(STORAGE_LOCAL, LEGACY_IMPORTED_KEY) === null;
  const levels = firstImport ? readLegacy() : DEFAULT_LEVELS;
  setStorageItem(STORAGE_LOCAL, accountKey(owner), JSON.stringify(levels));
  if (firstImport) setStorageItem(STORAGE_LOCAL, LEGACY_IMPORTED_KEY, owner);
  return { ...levels };
}

export function setChroniclesAudioVolume(channel, value) {
  if (channel !== 'music' && channel !== 'fx') {
    throw new Error('Unsupported Chronicles audio channel');
  }
  const level = normalize(value);
  const owner = currentOwner();
  // Late callbacks from another tab must not write into the new account.
  if (!owner && getStorageItem(STORAGE_LOCAL, USERNAME_KEY)) return level;
  if (owner) {
    const previous = getChroniclesAudioVolumes();
    setStorageItem(STORAGE_LOCAL, accountKey(owner),
      JSON.stringify({ ...previous, [channel]: level }));
  }
  // Compatibility for the existing music profile and SFX volume consumers.
  // The account-scoped copy above is the source of truth after a re-login.
  if (channel === 'music') writeAmbientVolume(level);
  else setStorageItem(STORAGE_LOCAL, LEGACY_FX_KEY, String(level));
  return level;
}

// Capture the old preference on first deployment BEFORE auth clears the
// Chess Studio profile cache. This does not preserve progress, tokens or
// another user's settings; the account-scoped volume survives logout.
export function preserveChroniclesAudioVolumesBeforeSessionClear() {
  if (currentOwner()) getChroniclesAudioVolumes();
}
