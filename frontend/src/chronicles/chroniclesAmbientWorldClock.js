import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// Even a stationary expedition lives under Terra's sky: one world minute
// passes per visible real second, committed only in five-second batches to
// keep WebGL asleep most of the time. No enemy/initiative turn is awarded.
export const CHRONICLES_AMBIENT_TICK_MS = 5000;
export const CHRONICLES_AMBIENT_TICK_MINUTES = 5;

export function chroniclesAdvanceAmbientWorldTime(state, map, minutes = CHRONICLES_AMBIENT_TICK_MINUTES) {
  if (!state || state.combatRules !== 'mm3' || state.phase !== 'explore'
      || state.initiative || !map || !['settlement', 'wilderness', 'outdoor'].includes(map.regionKind)
      || !Number.isSafeInteger(minutes) || minutes <= 0) return state;
  const elapsed = chroniclesWorldMinutes(state.worldMinutes);
  const nextMinutes = Math.min(Number.MAX_SAFE_INTEGER, elapsed + minutes);
  if (nextMinutes === elapsed) return state;
  return { ...state, worldMinutes: nextMinutes };
}

// No hidden-tab catch-up, even on browsers that throttle timers heavily.
// Resuming or leaving an overlay starts a FRESH five-second interval.
// Browser dependencies are injectable for deterministic unit tests.
export function attachChroniclesAmbientWorldClock(onTick, {
  doc = document, timer = window, intervalMs = CHRONICLES_AMBIENT_TICK_MS,
} = {}) {
  let timerId = null;
  let disposed = false;
  const stop = () => {
    if (timerId === null) return;
    timer.clearInterval(timerId);
    timerId = null;
  };
  const onVisibility = () => {
    if (disposed) return;
    if (doc.visibilityState !== 'visible') {
      stop();
    } else if (timerId === null) {
      timerId = timer.setInterval(() => {
        if (doc.visibilityState === 'visible') onTick();
      }, intervalMs);
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);
  onVisibility();
  return () => {
    if (disposed) return;
    disposed = true;
    stop();
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
