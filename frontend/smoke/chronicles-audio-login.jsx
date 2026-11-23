// Browser-only fixture using the REAL Chronicles audio controls and playback
// gain. Reproduce the synchronous auth storage lifecycle without contacting
// ShadowOps ID or using real credentials, identities or server-side data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bindProfileStorageIdentity, clearLocalUserState } from '../src/profileKeys.js';
import { STORAGE_LOCAL, getStorageItem, removeStorageItem, setStorageItem } from '../src/safeStorage.js';
import { preserveChroniclesAudioVolumesBeforeSessionClear } from '../src/chronicles/chroniclesVolumePreferences.js';
import { getChroniclesMusicVolume } from '../src/chronicles/chroniclesMusicPreferences.js';
import { syncChroniclesSoundtrackPlayback } from '../src/chronicles/useChroniclesSoundtrack.js';
import ChroniclesAudioControls from '../src/components/ChroniclesAudioControls.jsx';
import '../src/components/ChroniclesOfMatthias.css';

const OWNER_KEY = 'chess-study-auth-username';
const initialOwner = getStorageItem(STORAGE_LOCAL, OWNER_KEY) || null;
bindProfileStorageIdentity(initialOwner);

function switchAccount(nextOwner) {
  // These are the SAME cache/identity operations performed by auth.js on
  // successful explicit login/logout. auth.test.js covers the async login
  // API itself; this fixture probes the mounted React surface and real gain.
  preserveChroniclesAudioVolumesBeforeSessionClear();
  clearLocalUserState();
  if (nextOwner) setStorageItem(STORAGE_LOCAL, OWNER_KEY, nextOwner);
  else removeStorageItem(STORAGE_LOCAL, OWNER_KEY);
  bindProfileStorageIdentity(nextOwner);
}

function Fixture() {
  const [owner, setOwner] = useState(initialOwner);
  const [gain, setGain] = useState(null);
  function change(next) {
    switchAccount(next);
    setGain(null);
    setOwner(next);
  }
  function measureGain() {
    const audio = new Audio(); // Genuine HTMLAudioElement with no media URL/network fetch.
    syncChroniclesSoundtrackPlayback(audio, getChroniclesMusicVolume(), false);
    setGain(audio.volume);
  }
  return (
    <main style={{ maxWidth: 640, margin: '32px auto', padding: 16 }}>
      <h1>Chronicles · Audio</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => change('alice')}>Entrar Alice</button>
        <button type="button" onClick={() => change('bob')}>Entrar Bob</button>
        <button type="button" onClick={() => change(null)}>Cerrar sesión</button>
      </div>
      <section data-audio-owner={owner || 'anonymous'} style={{ paddingTop: 24 }}>
        {owner && <ChroniclesAudioControls key={owner} idPrefix="audio-smoke" />}
        {owner && <button type="button" onClick={measureGain}>Comprobar volumen real</button>}
        <output data-audio-gain>{gain === null ? 'sin medir' : gain.toFixed(3)}</output>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Fixture />);
