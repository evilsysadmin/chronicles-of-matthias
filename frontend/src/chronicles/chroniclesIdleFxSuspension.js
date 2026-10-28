// Chronicles' procedural effects share a Web Audio context with the main
// radio, while its own music is an HTMLAudioElement. After gestures/FX have
// had time to finish, a one-shot timer may park the silent Web Audio context.
// No polling loop, network telemetry or extra work while outside Chronicles.
export const CHRONICLES_FX_IDLE_SUSPEND_MS = 10_000;
export const CHRONICLES_FX_ACTIVITY_EVENT = 'chronicles-fx-audio-activity';

// Only actual audible SFX (after volume/source checks) broadcast this local
// event. A long-delayed enemy sound can reactivate WebAudio after an earlier
// idle suspension, even when no pointer or keyboard gesture has occurred.
export function announceChroniclesFxActivity(target = typeof window !== 'undefined' ? window : null) {
  if (!target?.dispatchEvent || typeof Event === 'undefined') return false;
  target.dispatchEvent(new Event(CHRONICLES_FX_ACTIVITY_EVENT));
  return true;
}

export function listenForChroniclesFxActivity(target, callback) {
  if (!target?.addEventListener || !target?.removeEventListener) return () => {};
  target.addEventListener(CHRONICLES_FX_ACTIVITY_EVENT, callback);
  return () => target.removeEventListener(CHRONICLES_FX_ACTIVITY_EVENT, callback);
}

export function createChroniclesIdleFxSuspension({
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (id) => clearTimeout(id),
  canSuspend,
  suspend,
} = {}) {
  let timeoutId = null;
  let disposed = false;

  function activity() {
    if (disposed) return;
    if (timeoutId !== null) cancel(timeoutId);
    timeoutId = schedule(() => {
      timeoutId = null;
      if (disposed || !canSuspend?.()) return;
      suspend?.();
    }, CHRONICLES_FX_IDLE_SUSPEND_MS);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (timeoutId !== null) cancel(timeoutId);
    timeoutId = null;
  }

  return { activity, dispose };
}
