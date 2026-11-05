import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// Real visible exploration: five minutes earn ten additional Terra minutes.
// Movement still costs its own ten minutes and NEVER resets the real counter.
export const CHRONICLES_AMBIENT_REAL_BLOCK_MS = 5 * 60 * 1000;
export const CHRONICLES_AMBIENT_WORLD_MINUTES = 10;

export function chroniclesAdvanceAmbientWorldTime(state, map, minutes = CHRONICLES_AMBIENT_WORLD_MINUTES) {
  if (!state || state.combatRules !== 'mm3' || state.phase !== 'explore'
      || state.initiative || !map || !['settlement', 'wilderness', 'outdoor'].includes(map.regionKind)
      || !Number.isSafeInteger(minutes) || minutes <= 0) return state;
  const elapsed = chroniclesWorldMinutes(state.worldMinutes);
  const next = Math.min(Number.MAX_SAFE_INTEGER, elapsed + minutes);
  return next === elapsed ? state : { ...state, worldMinutes: next };
}

// A ref-owned accumulator: fractions survive moves, pauses and region changes.
// Due credits remain banked if the party is temporarily in combat.
export function createChroniclesAmbientTimeCounter() {
  let remainderMs = 0;
  let pendingWorldMinutes = 0;
  return {
    accrue(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return pendingWorldMinutes;
      const elapsed = remainderMs + ms;
      const blocks = Math.floor(elapsed / CHRONICLES_AMBIENT_REAL_BLOCK_MS);
      remainderMs = elapsed - blocks * CHRONICLES_AMBIENT_REAL_BLOCK_MS;
      pendingWorldMinutes += blocks * CHRONICLES_AMBIENT_WORLD_MINUTES;
      return pendingWorldMinutes;
    },
    getRemainderMs: () => remainderMs,
    getPendingWorldMinutes: () => pendingWorldMinutes,
    msUntilNextBlock: () => CHRONICLES_AMBIENT_REAL_BLOCK_MS - remainderMs,
    claimWorldMinutes() {
      const due = pendingWorldMinutes;
      pendingWorldMinutes = 0;
      return due;
    },
    reset() { remainderMs = 0; pendingWorldMinutes = 0; },
  };
}

// One timer at the NEXT real five-minute threshold, rather than a React
// interval or WebGL animation loop. A monotonic clock preserves the extra
// minute if the browser wakes six minutes after the previous boundary.
// Hidden tabs and modals do not accrue; a resumed session keeps fractions.
export function attachChroniclesAmbientWorldClock(onTick, {
  doc = document, timer = window, now = () => performance.now(),
  counter = createChroniclesAmbientTimeCounter(),
} = {}) {
  let timeoutId = null;
  let activeSince = null;
  let disposed = false;
  const deliver = () => {
    const due = counter.getPendingWorldMinutes();
    if (due && onTick(due) !== false) counter.claimWorldMinutes();
  };
  const sample = () => {
    if (activeSince === null) return;
    const instant = now();
    counter.accrue(Math.max(0, instant - activeSince));
    activeSince = instant;
  };
  const stop = () => {
    if (timeoutId !== null) timer.clearTimeout(timeoutId);
    timeoutId = null;
    if (activeSince !== null) {
      sample();
      activeSince = null;
    }
  };
  const schedule = () => {
    if (disposed || doc.visibilityState !== 'visible') return;
    timeoutId = timer.setTimeout(wake, Math.max(1, Math.ceil(counter.msUntilNextBlock())));
  };
  const wake = () => {
    timeoutId = null;
    if (disposed || doc.visibilityState !== 'visible') { stop(); return; }
    sample();
    deliver();
    schedule();
  };
  const start = () => {
    if (disposed || activeSince !== null || doc.visibilityState !== 'visible') return;
    activeSince = now();
    deliver();
    schedule();
  };
  const visibilityChange = () => {
    if (doc.visibilityState === 'visible') start();
    else stop();
  };
  doc.addEventListener('visibilitychange', visibilityChange);
  start();
  return () => {
    if (disposed) return;
    stop();
    disposed = true;
    doc.removeEventListener('visibilitychange', visibilityChange);
  };
}
