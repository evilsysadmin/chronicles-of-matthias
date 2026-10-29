/**
 * Chronicles only accepts a primary (left) click for gameplay controls.
 * Capture the event before it reaches the canvas, portraits or browser
 * middle-click autoscroll. Touch and pen primary presses use button=0 too.
 * Do not interfere with keyboard activation (which has no mouse button).
 */
export function chroniclesBlockNonPrimaryClick(event) {
  if (typeof event?.button !== 'number' || event.button === 0) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}

/** Native browser image/canvas context menus have no role in Chronicles. */
export function chroniclesPreventNativeContextMenu(event) {
  event.preventDefault();
  event.stopPropagation();
}
