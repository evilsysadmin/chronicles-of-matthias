// A travel choice is still a modal interaction even when its backdrop is
// visually subtle. Keyboard focus must not drift into the map/HUD underneath.
export function chroniclesBindAreaTravelFocus(dialog, doc) {
  if (!dialog || !doc) return () => {};
  const previous = doc.activeElement;
  const cancel = dialog.querySelector('[data-area-transition-cancel]');
  const keepInside = (event) => {
    if (!dialog.contains(event.target)) cancel?.focus({ preventScroll: true });
  };
  doc.addEventListener('focusin', keepInside);
  cancel?.focus({ preventScroll: true });
  return () => {
    doc.removeEventListener('focusin', keepInside);
    // A confirmed crossing may unmount its originating button; never focus
    // a stale element or a control that lived inside the disappearing dialog.
    if (previous?.isConnected && !dialog.contains(previous) && typeof previous.focus === 'function') {
      previous.focus({ preventScroll: true });
    }
  };
}

// A highlighted travel choice is focus, not an independent state variable.
// Keep arrows, Enter, Escape and legacy explicit Y/N keys deterministic.
export function chroniclesAreaTravelKeyDecision(key, focusedChoice = 'cancel') {
  if (key === 'ArrowLeft') return 'focus-cancel';
  if (key === 'ArrowRight') return 'focus-accept';
  if (key === 'Enter') return focusedChoice === 'accept' ? 'accept' : 'cancel';
  if (key === 'Escape' || key === 'n' || key === 'N') return 'cancel';
  if (key === 'y' || key === 'Y' || key === 's' || key === 'S') return 'accept';
  return null;
}
