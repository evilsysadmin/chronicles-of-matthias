// Shell standalone: login original de Chess Studio → directo al juego.
// Monta Chronicles exactamente como lo hace LabScreen en Chess Studio
// (lazy + Suspense + onExit + petición de horizontal en la entrada).
// Tactics no tiene botón propio: se abre en /#tactics.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import LoginScreen from '../components/LoginScreen.jsx';
import { fetchMeStatus, isLoggedIn, logout, reportLogoutPresence, watchSessionIdentity } from '../auth.js';
import { onSessionExpired } from '../sessionExpiry.js';
import {
  releaseChroniclesLandscape,
  requestChroniclesLandscapeOnEntry,
} from '../components/useChroniclesLandscape.js';

const ChroniclesOfMatthias = lazy(() => import('../components/ChroniclesOfMatthias.jsx'));
const ChroniclesOfMatthiasTactics = lazy(() => import('../components/ChroniclesOfMatthiasTactics.jsx'));

function Loading() {
  return <div className="menu tournament-panel lab-screen"><p className="hint-text friendly-lead">Cargando Chronicles…</p></div>;
}

function currentMode() {
  return window.location.hash === '#tactics' ? 'chronicles-tactics' : 'chronicles';
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [mode, setMode] = useState(currentMode);
  // Sin castillo al que volver: salir del juego reinicia el libro de expediciones.
  const [mountKey, setMountKey] = useState(0);

  // A stored token is not proof of a session: the API may have rejected it
  // (expired, revoked, issued by another server). Check once on entry and
  // drop to the login screen whenever any request answers 401.
  const [expiredNotice, setExpiredNotice] = useState(null);
  useEffect(() => {
    const expire = () => {
      logout();
      setExpiredNotice('Tu sesión ha caducado. Vuelve a entrar para seguir tu expedición.');
      setLoggedIn(false);
    };
    const stop = onSessionExpired(expire);
    if (isLoggedIn()) {
      void fetchMeStatus().then((result) => {
        if (result.status === 'unauthorized' && isLoggedIn()) expire();
      });
    }
    return stop;
  }, []);

  useEffect(() => watchSessionIdentity?.(() => setLoggedIn(isLoggedIn())), []);
  useEffect(() => {
    const onHash = () => setMode(currentMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (loggedIn) void requestChroniclesLandscapeOnEntry();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <LoginScreen
        key={expiredNotice || 'login'}
        initialNotice={expiredNotice}
        onLoggedIn={() => { setExpiredNotice(null); setLoggedIn(true); }}
      />
    );
  }

  const exit = () => {
    void releaseChroniclesLandscape();
    setMountKey((k) => k + 1);
  };
  // The book's cog: tell the server this session is leaving, then forget it.
  const signOut = async () => {
    await reportLogoutPresence().catch(() => {});
    void releaseChroniclesLandscape();
    logout();
    setExpiredNotice(null);
    setLoggedIn(false);
  };
  const Game = mode === 'chronicles-tactics' ? ChroniclesOfMatthiasTactics : ChroniclesOfMatthias;

  return (
    <Suspense fallback={<Loading />}>
      <Game key={`${mode}-${mountKey}`} onExit={exit} onLogout={signOut} />
    </Suspense>
  );
}
