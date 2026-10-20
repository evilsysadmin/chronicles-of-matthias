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
        <img
          className="chronicles-loading__crest"
          src="/chronicles-loading-crest.svg"
          alt=""
          aria-hidden="true"
          decoding="async"
        />
        <h1 className="chronicles-loading__title">CHRONICLES</h1>
        <span className="chronicles-loading__flourish" />
        <p className="chronicles-loading__label">Cargando Chronicles…</p>
        <span className="chronicles-loading__track"><span className="chronicles-loading__light" /></span>
      </div>
      <span className="chronicles-loading__sr">Cargando Chronicles…</span>
    </main>
  );
}
