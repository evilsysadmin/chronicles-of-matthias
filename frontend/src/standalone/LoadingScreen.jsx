import { useState } from 'react';
import './loadingScreen.css';

const artwork = '/chronicles-loading-art.svg';

// Shared by silent SSO restoration and lazy-loaded game/tactics modes.
// The artwork contains its own title and ornamental progress *illustration*;
// never claim a synthetic percentage is actual network progress.
export default function LoadingScreen() {
  const [artReady, setArtReady] = useState(false);

  return (
    <main className="chronicles-loading" role="status" aria-live="polite" aria-label="Cargando Chronicles">
      <img
        className={`chronicles-loading__art ${artReady ? 'is-ready' : ''}`}
        src={artwork}
        alt=""
        aria-hidden="true"
        decoding="async"
        onLoad={() => setArtReady(true)}
        onError={() => setArtReady(false)}
      />
      <div className={`chronicles-loading__fallback ${artReady ? 'has-art' : ''}`} aria-hidden="true">
        <svg className="chronicles-loading__crest" viewBox="0 0 160 190" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="loading-metal" x1="15" y1="0" x2="147" y2="190" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f5d8a1" />
              <stop offset=".48" stopColor="#9a7046" />
              <stop offset="1" stopColor="#e8c48f" />
            </linearGradient>
            <linearGradient id="loading-blade" x1="70" y1="10" x2="96" y2="170" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff1d2" />
              <stop offset=".6" stopColor="#b6bcc2" />
              <stop offset="1" stopColor="#424a57" />
            </linearGradient>
          </defs>
          <path d="M80 32 136 51 129 113Q116 153 80 174 44 153 31 113L24 51Z" fill="#08131e" stroke="url(#loading-metal)" strokeWidth="5" />
          <path d="M80 45 123 59 117 109Q107 140 80 159 53 140 43 109L37 59Z" stroke="#c1a072" strokeOpacity=".38" />
          <circle cx="80" cy="103" r="34" stroke="#ac875b" strokeOpacity=".65" strokeWidth="2" />
          <path d="M80 58 88 95 126 103 88 111 80 149 72 111 34 103 72 95Z" fill="#ac875b" fillOpacity=".58" />
          <path d="M80 14 85 22 80 30 75 22Z" fill="url(#loading-metal)" stroke="#efc997" />
          <path d="M74 28H86L84 140 80 160 76 140Z" fill="url(#loading-blade)" stroke="#f3d5a5" strokeWidth="1" />
          <path d="M57 44 69 39 80 43 91 39 103 44 92 50 80 48 68 50Z" fill="url(#loading-metal)" stroke="#f1d9b5" strokeWidth="1.5" />
          <path d="M77 17H83V43H77Z" fill="#272d37" stroke="#ba925c" strokeWidth="1.5" />
          <path d="M80 40 84 44 80 48 76 44Z" fill="#64a5ca" />
        </svg>
        <h1 className="chronicles-loading__title">CHRONICLES</h1>
        <span className="chronicles-loading__flourish" />
        <p className="chronicles-loading__label">Cargando Chronicles…</p>
        <span className="chronicles-loading__track"><span className="chronicles-loading__light" /></span>
      </div>
      <span className="chronicles-loading__sr">Cargando Chronicles…</span>
    </main>
  );
}
