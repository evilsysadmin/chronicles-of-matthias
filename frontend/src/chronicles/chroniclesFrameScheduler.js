// Static scenes paint once. Actions may animate briefly; afterwards no RAF
// remains queued. Background tabs and destroyed scenes cancel pending work.
export function createChroniclesFrameScheduler({ requestFrame, cancelFrame, now, draw }) {
  let frameId = null;
  let animateUntil = 0;
  let visible = true;
  let disposed = false;

  function tick() {
    frameId = null;
    if (disposed || !visible) return;
    const finalFrame = now() >= animateUntil;
    draw(finalFrame);
    if (!finalFrame && !disposed && visible && frameId === null) {
      frameId = requestFrame(tick);
    }
  }

  function invalidate(durationMs = 0) {
    if (disposed || !visible) return;
    animateUntil = Math.max(animateUntil, now() + Math.max(0, durationMs));
    if (frameId === null) frameId = requestFrame(tick);
  }

  function setVisible(nextVisible) {
    if (disposed || visible === Boolean(nextVisible)) return;
    visible = Boolean(nextVisible);
    if (!visible) {
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      animateUntil = 0;
    } else {
      invalidate(0);
    }
  }

  function dispose() {
    disposed = true;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
  }

  return { invalidate, setVisible, dispose };
}
