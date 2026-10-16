// Mobile browser orientation is permission/gesture-gated. This module
// attempts the REAL device landscape lock during the user's Play click.
// Never CSS-rotate canvas or swap axes: touch hit testing must remain correct.
export function isHandheldPortrait(win = globalThis.window) {
  if (!win) return false;
  const coarse = win.matchMedia?.('(pointer: coarse)')?.matches
    ?? Number(win.navigator?.maxTouchPoints || 0) > 0;
  const portrait = win.matchMedia?.('(orientation: portrait)')?.matches
    ?? win.innerHeight > win.innerWidth;
  return Boolean(coarse && portrait);
}

export function createLandscapeGameSession({
  win = globalThis.window,
  doc = globalThis.document,
  onChange = () => {},
} = {}) {
  let active = true;
  let requestedFullscreen = false;
  let attemptedLock = false;
  let lastFailure = '';
  const element = doc?.documentElement;
  const orientation = win?.screen?.orientation;

  function status() {
    return {
      needsRotation: isHandheldPortrait(win),
      lockAttempted: attemptedLock,
      failure: lastFailure,
    };
  }

  function notify() {
    if (active) onChange(status());
  }

  async function enter() {
    if (!active || !isHandheldPortrait(win)) {
      notify();
      return status();
    }
    // Fullscreen must be REQUESTED INSIDE A REAL USER GESTURE. Calling this
    // from useEffect on navigation or page load cannot acquire permission.
    let fullscreenGranted = doc?.fullscreenElement === element;
    if (!fullscreenGranted && typeof element?.requestFullscreen === 'function') {
      try {
        await element.requestFullscreen({ navigationUI: 'hide' });
        fullscreenGranted = doc?.fullscreenElement === element;
        if (fullscreenGranted) requestedFullscreen = true;
      } catch {
        lastFailure = 'fullscreen-denied';
      }
    }
    if (!active) {
      // Navigation may have completed while permission UI was open.
      if (requestedFullscreen && doc?.fullscreenElement === element) {
        try { await doc.exitFullscreen?.(); } catch { /* no-op */ }
      }
      return status();
    }
    if (typeof orientation?.lock === 'function') {
      attemptedLock = true;
      try {
        await orientation.lock('landscape');
        lastFailure = '';
      } catch {
        lastFailure = 'orientation-denied';
      }
    } else {
      lastFailure = 'orientation-unsupported';
    }
    notify();
    return status();
  }

  function leave() {
    if (!active) return;
    active = false;
    // Only unlock what the game requested; never exit the user's unrelated
    // fullscreen session.
    if (attemptedLock && typeof orientation?.unlock === 'function') {
      try { orientation.unlock(); } catch { /* browser denied */ }
    }
    if (requestedFullscreen && doc?.fullscreenElement === element) {
      try {
        const pending = doc.exitFullscreen?.();
        pending?.catch?.(() => {});
      } catch { /* fullscreen already ended */ }
    }
  }

  return { enter, leave, status, notify };
}
