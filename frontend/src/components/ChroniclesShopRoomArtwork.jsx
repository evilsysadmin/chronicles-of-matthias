import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ChroniclesShop.css';
import './ChroniclesInteriorLoading.css';

// Share an atomic first frame across every merchant and civic interior.
// Remote art gets a real decode gate; a bundled SVG is only revealed when the
// remote file fails or exceeds the bounded network budget, never as a flash.
export function ShopRoomArtwork({ room, onCancel }) {
  const remote = Boolean(room.fallbackSrc && room.src !== room.fallbackSrc);
  const [phase, setPhase] = useState('loading');
  const [fallbackDone, setFallbackDone] = useState(false);
  const [fallbackBroken, setFallbackBroken] = useState(false);
  const [premiumFailed, setPremiumFailed] = useState(false);
  const premiumRef = useRef(null);
  const fallbackRef = useRef(null);
  const cancelRef = useRef(null);

  // Never strand the player in black if CDN/network/decode stalls forever.
  // Ten seconds is an error budget, not an intentional delay for cached art.
  useEffect(() => {
    const timer = window.setTimeout(() => setPhase(current => (
      current === 'loading' ? 'fallback' : current
    )), 10000);
    return () => window.clearTimeout(timer);
  }, [room.src]);

  useEffect(() => {
    if (remote && premiumFailed && fallbackDone) setPhase(current => (
      current === 'loading' ? 'fallback' : current
    ));
  }, [remote, premiumFailed, fallbackDone]);

  // The fullscreen gate owns focus and Tab while loading. Escape is left to
  // the existing modal handler; the visible cancel button works on touch.
  useEffect(() => {
    if (phase === 'loading') {
      const onKey = event => {
        if (event.key === 'Tab') {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelRef.current?.focus();
        }
      };
      window.addEventListener('keydown', onKey, { capture: true });
      const focus = window.setTimeout(() => cancelRef.current?.focus(), 0);
      return () => {
        window.removeEventListener('keydown', onKey, { capture: true });
        window.clearTimeout(focus);
      };
    }
    premiumRef.current?.closest('[role="dialog"]')
      ?.querySelector('.chronicles-shop__close')?.focus({ preventScroll: true });
    return undefined;
  }, [phase]);

  const decoded = (img, success, failure) => {
    if (!img?.naturalWidth) { failure(); return; }
    // onLoad alone is not enough: wait until the whole image can be painted.
    Promise.resolve().then(() => img.decode?.()).then(() => {
      if (img.isConnected) success();
    }, () => {
      if (img.isConnected) failure();
    });
  };
  const localReady = () => setPhase('premium');
  const localFailed = () => { setFallbackBroken(true); setPhase('fallback'); };
  const onFallbackReady = () => setFallbackDone(true);
  const onFallbackFailed = () => { setFallbackBroken(true); setFallbackDone(true); };

  // A memory/disk-cache hit can already be complete by the time effects run.
  useEffect(() => {
    const premium = premiumRef.current;
    if (premium?.complete) {
      if (premium.naturalWidth) decoded(premium, localReady,
        remote ? () => setPremiumFailed(true) : localFailed);
      else if (remote) setPremiumFailed(true);
      else localFailed();
    }
    const fallback = fallbackRef.current;
    if (remote && fallback?.complete) {
      if (fallback.naturalWidth) decoded(fallback, onFallbackReady, onFallbackFailed);
      else onFallbackFailed();
    }
  }, [room.src]);

  const gate = phase === 'loading' ? (
    <div className="chronicles-interior-loading" data-chronicles-interior-loading
      role="status" aria-label="Cargando interior de Chronicles">
      <div className="chronicles-interior-loading__identity" aria-hidden="true">
        <span>CHRONICLES</span>
        <i />
        <small>CARGANDO INTERIOR</small>
      </div>
      <button ref={cancelRef} type="button"
        className="chronicles-interior-loading__cancel"
        aria-label="Salir durante la carga" onClick={onCancel}>Salir</button>
    </div>
  ) : null;

  return (
    <>
      {remote && <img ref={fallbackRef} src={room.fallbackSrc} alt={room.alt}
        draggable="false" decoding="async"
        style={fallbackBroken ? { visibility: 'hidden' } : undefined}
        data-chronicles-shop-art-layer="fallback"
        onLoad={event => decoded(event.currentTarget, onFallbackReady, onFallbackFailed)}
        onError={onFallbackFailed} />}
      <img ref={premiumRef} src={room.src} alt={remote ? '' : room.alt}
        aria-hidden={remote ? 'true' : undefined} draggable="false"
        decoding="async" data-chronicles-shop-art-layer={remote ? 'premium' : undefined}
        style={!remote && fallbackBroken ? { visibility: 'hidden' } : undefined}
        className={remote ? `chronicles-shop__premium-art${phase === 'premium' ? ' is-ready' : ''}` : undefined}
        onLoad={event => decoded(event.currentTarget, localReady,
          remote ? () => setPremiumFailed(true) : localFailed)}
        onError={remote ? () => setPremiumFailed(true) : localFailed} />
      {gate && (typeof document === 'undefined' ? gate : createPortal(gate, document.body))}
    </>
  );
}

