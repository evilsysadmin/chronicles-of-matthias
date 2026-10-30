import { useEffect, useRef, useState } from 'react';
import { getUsername } from '../auth.js';
import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';
import './ChroniclesAccountMenu.css';

function fullscreenActive() {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
}

// The cog on the expedition book: who is signed in, sound levels, full
// screen and sign out. In Chess Studio this lived in the castle's masthead; the standalone
// site has no castle, so the book carries it.
export default function ChroniclesAccountMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [fullscreen, setFullscreen] = useState(fullscreenActive);
  const rootRef = useRef(null);
  const username = getUsername();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setFullscreen(fullscreenActive());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const canFullscreen = typeof document !== 'undefined' && typeof document.documentElement?.requestFullscreen === 'function';

  async function toggleFullscreen() {
    try {
      if (fullscreenActive()) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // The browser refused (iOS Safari, embedded views): nothing to do.
    }
    setOpen(false);
  }

  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout?.();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="chronicles-account" ref={rootRef}>
      <button
        type="button"
        className="chronicles-account__cog"
        aria-label="Cuenta y ajustes"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-chronicles-account-menu
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open && (
        <div className="chronicles-account__popover" role="dialog" aria-label="Cuenta y ajustes">
          <p className="chronicles-account__who">
            <span aria-hidden="true">♙</span>
            <span><small>Sesión iniciada como</small><b>{username?.startsWith('shadowops:') ? 'Cuenta ShadowOps' : username || 'aventurero'}</b></span>
          </p>
          <ChroniclesAudioControls
            idPrefix="chronicles-account"
            legend="Sonido"
            className="chronicles-account__audio"
          />
          {canFullscreen && (
            <button type="button" onClick={toggleFullscreen}>
              <span aria-hidden="true">⛶</span>
              <span><b>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</b><small>Más espacio para la mazmorra</small></span>
            </button>
          )}
          <div className="chronicles-account__separator" role="separator" />
          <button type="button" className="chronicles-account__logout" onClick={signOut} disabled={loggingOut} data-chronicles-logout>
            <span aria-hidden="true">↪</span>
            <span><b>{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</b><small>Tus expediciones se quedan en el servidor</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
