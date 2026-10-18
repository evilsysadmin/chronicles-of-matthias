import { useCallback, useEffect, useState } from 'react';
import { STORAGE_SESSION, getStorageItem, removeStorageItem, setStorageItem } from '../safeStorage.js';
import {
  requestWarRoomLandscapeFullscreen,
  exitWarRoomBrowserFullscreen,
  unlockWarRoomOrientation,
} from './useWarRoomImmersive.js';

// Only fullscreen initiated by Chronicles may be dismissed when the game exits.
let chroniclesFullscreenOwned = false;
// The player chose landscape (on entry or with the rotate control). A task
// switch on Android drops fullscreen and the lock with it, and the browser
// often reloads the page on the way back, so the choice lives in the tab's
// session storage, not in memory.
const LANDSCAPE_WANTED_KEY = 'chronicles-landscape-wanted';
function landscapeWanted() {
  return getStorageItem(STORAGE_SESSION, LANDSCAPE_WANTED_KEY) === '1';
}
function rememberLandscapeWanted(wanted) {
  if (wanted) setStorageItem(STORAGE_SESSION, LANDSCAPE_WANTED_KEY, '1');
  else removeStorageItem(STORAGE_SESSION, LANDSCAPE_WANTED_KEY);
}

export const CHRONICLES_PHONE_QUERY = '(pointer: coarse) and (max-width: 920px)';
export const CHRONICLES_LANDSCAPE_QUERY = '(orientation: landscape) and (max-width: 920px) and (max-height: 620px)';

export function shouldAutoRotateChroniclesOnEntry({ win = globalThis.window } = {}) {
  if (!win || typeof win.matchMedia !== 'function') return false;
  return Boolean(
    win.matchMedia('(pointer: coarse)').matches
    && (Number(win.innerWidth) || Number.POSITIVE_INFINITY) <= 920,
  );
}

// A foreground resume is not a user gesture. Never try to enter fullscreen
// here; only restore an existing mobile fullscreen session in portrait.
export function shouldRestoreChroniclesLandscapeOnResume({
  win = globalThis.window,
  doc = globalThis.document,
  screenApi = globalThis.screen,
} = {}) {
  return Boolean(
    win && doc && doc.visibilityState !== 'hidden'
    && doc.fullscreenElement
    && shouldAutoRotateChroniclesOnEntry({ win })
    && !win.matchMedia(CHRONICLES_LANDSCAPE_QUERY).matches
    && typeof screenApi?.orientation?.lock === 'function'
  );
}

// Back from another app in portrait, after the player had chosen landscape:
// the next tap is the user gesture fullscreen needs.
export function shouldRelockChroniclesOnTap({
  win = globalThis.window,
  doc = globalThis.document,
} = {}) {
  return Boolean(
    landscapeWanted()
    && win && doc && doc.visibilityState !== 'hidden'
    && shouldAutoRotateChroniclesOnEntry({ win })
    && !win.matchMedia(CHRONICLES_LANDSCAPE_QUERY).matches,
  );
}

// Mobile browsers commonly refuse orientation.lock() unless the document is
// fullscreen. The user gesture that launches Chronicles is our chance to
// request both. Native fullscreen may consume the first Escape; the in-game
// menu remains reachable using touch controls.
export async function requestChroniclesLandscapeOnEntry({
  win = globalThis.window,
  doc = globalThis.document,
  screenApi = globalThis.screen,
} = {}) {
  if (!shouldAutoRotateChroniclesOnEntry({ win })) {
    return { requested: false, fullscreen: false, landscape: false };
  }
  const result = await requestWarRoomLandscapeFullscreen({ doc, screenApi });
  if (result.fullscreen) chroniclesFullscreenOwned = true;
  if (result.landscape) rememberLandscapeWanted(true);
  return { requested: true, ...result };
}

export async function releaseChroniclesLandscape({
  doc = globalThis.document,
  screenApi = globalThis.screen,
} = {}) {
  const ownedFullscreen = chroniclesFullscreenOwned;
  chroniclesFullscreenOwned = false;
  rememberLandscapeWanted(false);
  const unlocked = unlockWarRoomOrientation(screenApi);
  // Never dismiss pre-existing or user-owned fullscreen.
  const fullscreen = ownedFullscreen ? await exitWarRoomBrowserFullscreen(doc) : false;
  return { unlocked, fullscreen };
}

export default function useChroniclesLandscape(enabled = true) {
  const readViewport = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return { phone: false, landscape: false };
    }
    return {
      phone: window.matchMedia(CHRONICLES_PHONE_QUERY).matches,
      landscape: window.matchMedia(CHRONICLES_LANDSCAPE_QUERY).matches,
    };
  }, []);

  const [viewport, setViewport] = useState(readViewport);
  const [lockState, setLockState] = useState('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const phoneMedia = window.matchMedia(CHRONICLES_PHONE_QUERY);
    const landscapeMedia = window.matchMedia(CHRONICLES_LANDSCAPE_QUERY);
    const refresh = () => setViewport({ phone: phoneMedia.matches, landscape: landscapeMedia.matches });
    refresh();
    phoneMedia.addEventListener?.('change', refresh);
    landscapeMedia.addEventListener?.('change', refresh);
    return () => {
      phoneMedia.removeEventListener?.('change', refresh);
      landscapeMedia.removeEventListener?.('change', refresh);
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    // Browser task switches may drop the landscape lock or native fullscreen.
    // Restore the lock only when fullscreen remains; otherwise the existing
    // rotation control provides the required fresh user gesture.
    let active = true;
    let retrying = false;
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      setViewport(readViewport());
      if (retrying || !shouldRestoreChroniclesLandscapeOnResume()) return;
      retrying = true;
      try {
        Promise.resolve(globalThis.screen.orientation.lock('landscape')).then(
          () => { if (active) setLockState('locked'); },
          () => { if (active) setLockState('rejected'); },
        ).finally(() => { retrying = false; });
      } catch {
        retrying = false;
        if (active) setLockState('rejected');
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
    };
  }, [enabled, readViewport]);

  useEffect(() => () => {
    void releaseChroniclesLandscape();
  }, []);

  const activateLandscape = useCallback(async () => {
    const result = await requestChroniclesLandscapeOnEntry();
    const nextState = result.landscape ? 'locked' : 'rejected';
    setLockState(nextState);
    setViewport(readViewport());
    return nextState;
  }, [readViewport]);

  // Back in portrait after choosing landscape: the browser only restores
  // fullscreen and the lock from a real tap, so ask for one, plainly.
  const declineLandscape = useCallback(() => {
    rememberLandscapeWanted(false);
    setViewport(readViewport());
  }, [readViewport]);

  const relockPrompt = Boolean(enabled && viewport.phone && !viewport.landscape && shouldRelockChroniclesOnTap());

  return {
    relockPrompt,
    declineLandscape,
    needsRotation: Boolean(enabled && viewport.phone && !viewport.landscape),
    lockState,
    activateLandscape,
  };
}
