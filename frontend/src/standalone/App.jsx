// Shell standalone: login original de Chess Studio → directo al juego.
// Monta Chronicles exactamente como lo hace LabScreen en Chess Studio
// (lazy + Suspense + onExit + petición de horizontal en la entrada).
// Tactics no tiene botón propio: se abre en /#tactics.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import LoginScreen from '../components/LoginScreen.jsx';
import ReleaseUpdateNotice from './ReleaseUpdateNotice.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import { beginSilentSsoRestore } from './ssoRestoreGate.js';
import {
  fetchMeStatus, isLoggedIn, logout, refreshSsoToken, reportLogoutPresence, restoreSsoSession, startSsoRefresh,
  watchSessionIdentity,
} from '../auth.js';
import { centralIdentityActive, ssoEnabled } from '../shadowopsIdentity.js';
import { onSessionExpired } from '../sessionExpiry.js';
import {
  releaseChroniclesLandscape,
  requestChroniclesLandscapeOnEntry,
} from '../components/useChroniclesLandscape.js';

const ChroniclesOfMatthias = lazy(() => import('../components/ChroniclesOfMatthias.jsx'));
const ChroniclesOfMatthiasTactics = lazy(() => import('../components/ChroniclesOfMatthiasTactics.jsx'));

function currentMode() {
  return window.location.hash === '#tactics' ? 'chronicles-tactics' : 'chronicles';
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  // Already signed in to ShadowOps (Chess Studio or another game)? Then
  // there is no form: ask the identity provider silently first.
  const [checkingSso, setCheckingSso] = useState(() => (!isLoggedIn() || centralIdentityActive()) && ssoEnabled());
  useEffect(() => {
    if (!checkingSso) return;
    return beginSilentSsoRestore(restoreSsoSession, (result) => {
      if (result === 'authenticated') setLoggedIn(true);
      if (result === 'error' || result === 'timeout') {
        setExpiredNotice('No se pudo comprobar tu sesión ShadowOps. Puedes entrar manualmente.');
      }
      setCheckingSso(false);
    });
  }, [checkingSso]);
  useEffect(() => (loggedIn ? startSsoRefresh() : undefined), [loggedIn]);
  const [mode, setMode] = useState(currentMode);
  // Sin castillo al que volver: salir del juego reinicia el libro de expediciones.
  const [mountKey, setMountKey] = useState(0);

  // A stored token is not proof of a session: the API may have rejected it
  // (expired, revoked, issued by another server). Check once on entry and
  // drop to the login screen whenever any request answers 401.
  const [expiredNotice, setExpiredNotice] = useState(null);
  useEffect(() => {
    if (checkingSso) return undefined;
    const expire = () => {
      logout();
      setExpiredNotice('Tu sesión ha caducado. Vuelve a entrar para seguir tu expedición.');
      setLoggedIn(false);
    };
    const stop = onSessionExpired(expire);
    if (isLoggedIn()) {
      void fetchMeStatus().then(async (result) => {
        if (result.status !== 'unauthorized' || !isLoggedIn()) return;
        // An expired ShadowOps token is renewed from the cookie, not a logout.
        if (await refreshSsoToken()) return;
        expire();
      });
    }
    return stop;
  }, [checkingSso]);

  useEffect(() => watchSessionIdentity?.(() => setLoggedIn(isLoggedIn())), []);
  useEffect(() => {
    const onHash = () => setMode(currentMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (loggedIn) void requestChroniclesLandscapeOnEntry();
  }, [loggedIn]);

  if (checkingSso) return <><LoadingScreen /><ReleaseUpdateNotice deferReload /></>;
  if (!loggedIn) {
    return (
      <>
        <LoginScreen
          key={expiredNotice || 'login'}
          initialNotice={expiredNotice}
          onLoggedIn={() => { setExpiredNotice(null); setLoggedIn(true); }}
        />
        <ReleaseUpdateNotice deferReload={false} />
      </>
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
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Game key={`${mode}-${mountKey}`} onExit={exit} onLogout={signOut} />
      </Suspense>
      <ReleaseUpdateNotice deferReload />
    </>
  );
}
