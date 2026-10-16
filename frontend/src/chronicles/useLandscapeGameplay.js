import { useEffect, useRef, useState } from 'react';
import { createLandscapeGameSession, isHandheldPortrait } from './landscapeSession.js';

// Landscape starts only after a real Play/Confirm click. Mobile browsers
// cannot be forced to rotate merely by visiting an HTTPS URL.
export function useLandscapeGameplay(active) {
  const session = useRef(null);
  const [needsRotation, setNeedsRotation] = useState(false);

  function start() {
    if (!session.current) {
      session.current = createLandscapeGameSession({
        onChange: state => setNeedsRotation(state.needsRotation),
      });
    }
    // Deliberately invoked synchronously in a click handler rather than
    // useEffect, so requestFullscreen retains the browser user activation.
    void session.current.enter();
  }

  useEffect(() => {
    if (!active) return undefined;
    if (!session.current) {
      session.current = createLandscapeGameSession({
        onChange: state => setNeedsRotation(state.needsRotation),
      });
    }
    const update = () => setNeedsRotation(isHandheldPortrait());
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
      session.current?.leave();
      session.current = null;
    };
  }, [active]);

  return { start, retry: start, needsRotation: active && needsRotation };
}
