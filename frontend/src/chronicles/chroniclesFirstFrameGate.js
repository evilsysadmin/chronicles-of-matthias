// The scene is not ready merely because Three.js has constructed its objects.
// Reveal gameplay only after the authoritative state was fully synchronized
// and a real render call completed. Reduced-motion renders count too.
export function createChroniclesFirstFrameGate(onFirstFrame) {
  let synchronized = false;
  let notified = false;
  return {
    markStateSynchronized() { synchronized = true; },
    markFrameRendered() {
      if (!synchronized || notified) return false;
      notified = true;
      onFirstFrame?.();
      return true;
    },
  };
}
