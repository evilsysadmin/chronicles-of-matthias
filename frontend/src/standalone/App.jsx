// Shell standalone: login original de Chess Studio → vestíbulo → juego original.
// Monta Chronicles exactamente como lo hace LabScreen en Chess Studio
// (lazy + Suspense + onExit + petición de horizontal en el gesto de entrada).
import React, { Suspense, lazy, useEffect, useState } from 'react';
import LoginScreen from '../components/LoginScreen.jsx';
import { isLoggedIn, logout, watchSessionIdentity, getUsername } from '../auth.js';
import {
  releaseChroniclesLandscape,
  requestChroniclesLandscapeOnEntry,
} from '../components/useChroniclesLandscape.js';

const ChroniclesOfMatthias = lazy(() => import('../components/ChroniclesOfMatthias.jsx'));
const ChroniclesOfMatthiasTactics = lazy(() => import('../components/ChroniclesOfMatthiasTactics.jsx'));

function Loading() {
  return <div className="menu tournament-panel lab-screen"><p className="hint-text friendly-lead">Cargando Chronicles…</p></div>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());
  const [mode, setMode] = useState('hub');

  useEffect(() => watchSessionIdentity?.(() => setLoggedIn(isLoggedIn())), []);

  if (!loggedIn) return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;

  const exit = () => { void releaseChroniclesLandscape(); setMode('hub'); };
  const enter = (next) => { void requestChroniclesLandscapeOnEntry(); setMode(next); };

  if (mode === 'chronicles') {
    return <Suspense fallback={<Loading />}><ChroniclesOfMatthias onExit={exit} /></Suspense>;
  }
  if (mode === 'chronicles-tactics') {
    return <Suspense fallback={<Loading />}><ChroniclesOfMatthiasTactics onExit={exit} /></Suspense>;
  }

  return (
    <main className="standalone-hub">
      <h1>Chronicles of Matthias</h1>
      <p className="standalone-hub__user">{getUsername()}</p>
      <div className="standalone-hub__actions">
        <button type="button" onClick={() => enter('chronicles')}>Jugar Chronicles</button>
        <button type="button" onClick={() => enter('chronicles-tactics')}>Chronicles Tactics</button>
        <button type="button" className="standalone-hub__logout" onClick={() => { logout(); setLoggedIn(false); }}>Cerrar sesión</button>
      </div>
    </main>
  );
}
