import { useEffect, useState } from 'react';
import { APP_BUILD_ID } from '../release.js';
import { CHECK_INTERVAL_MS, fetchPublishedRelease, updateAvailable } from './releaseUpdate.js';
import './release-update.css';

const DISMISSED_PREFIX = 'chronicles-release-dismissed:';

function isDismissed(release) {
  try { return sessionStorage.getItem(DISMISSED_PREFIX + release) === '1'; }
  catch { return false; }
}

function rememberDismissed(release) {
  try { sessionStorage.setItem(DISMISSED_PREFIX + release, '1'); }
  catch { /* Storage may be blocked; notice is still dismissible in memory. */ }
}

// Never force a reload inside a running expedition. A user must leave the game
// and explicitly click Actualizar on the login screen.
export default function ReleaseUpdateNotice({ deferReload = true }) {
  const [latest, setLatest] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  useEffect(() => {
    let active = true;
    let timer = null;
    let rerun = false;
    let inFlight = false;
    const controller = new AbortController();

    async function check() {
      if (inFlight) { rerun = true; return; }
      inFlight = true;
      try {
        do {
          rerun = false;
          const current = await fetchPublishedRelease({
            base: import.meta.env.BASE_URL || '/', signal: controller.signal,
          });
          if (active && current) {
            setLatest(current);
            setDismissed(isDismissed(current));
          }
        } while (active && !controller.signal.aborted && rerun);
      } finally {
        inFlight = false;
      }
    }

    const start = () => {
      if (document.visibilityState === 'hidden' || timer) return;
      void check();
      timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(timer); timer = null;
      } else start();
    };
    const onFocus = () => {
      if (document.visibilityState !== 'hidden') void check();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, []);

  useEffect(() => { setSnoozed(false); }, [latest]);
  if (!updateAvailable(latest, APP_BUILD_ID) || dismissed || (deferReload && snoozed)) return null;

  const dismiss = () => {
    rememberDismissed(latest);
    setDismissed(true);
  };

  return (
    <aside className="chronicles-release-notice" role="status" aria-live="polite">
      <div className="chronicles-release-copy">
        <strong>Nueva versión disponible</strong>
        <span>{deferReload
          ? 'Continúa tu expedición. Actualiza después de salir para no interrumpirla.'
          : 'Hay mejoras nuevas listas para cargar.'}</span>
      </div>
      <div className="chronicles-release-actions">
        {deferReload ? (
          <button type="button" onClick={() => setSnoozed(true)}>Después</button>
        ) : (
          <>
            <button type="button" className="chronicles-release-primary"
              onClick={() => window.location.reload()}>Actualizar</button>
            <button type="button" onClick={dismiss}>Ahora no</button>
          </>
        )}
      </div>
    </aside>
  );
}
