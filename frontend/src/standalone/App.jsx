// Shell standalone: login original de Chess Studio → directo al juego.
// Monta Chronicles exactamente como lo hace LabScreen en Chess Studio
// (lazy + Suspense + onExit + petición de horizontal en la entrada).
// Tactics no tiene botón propio: se abre en /#tactics.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import LoginScreen from '../components/LoginScreen.jsx';
import { isLoggedIn, watchSessionIdentity } from '../auth.js';
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

  useEffect(() => watchSessionIdentity?.(() => setLoggedIn(isLoggedIn())), []);
  useEffect(() => {
    const onHash = () => setMode(currentMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (loggedIn) void requestChroniclesLandscapeOnEntry();
  }, [loggedIn]);

  if (!loggedIn) return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;

  const exit = () => {
    void releaseChroniclesLandscape();
    setMountKey((k) => k + 1);
  };
  const Game = mode === 'chronicles-tactics' ? ChroniclesOfMatthiasTactics : ChroniclesOfMatthias;

  return (
    <Suspense fallback={<Loading />}>
      <Game key={`${mode}-${mountKey}`} onExit={exit} />
    </Suspense>
  );
}
