import { useEffect, useRef } from 'react';
import { chroniclesWorldInfoShortcut } from '../chronicles/chroniclesKeyboardBindings.js';

// The real saved Terra calendar is read-only here. Opening the folio never
// changes world time, spends a turn or triggers a synthetic weather forecast.
export default function ChroniclesWorldInfo({ calendar, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!calendar) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous?.isConnected && previous !== document.body) previous.focus?.();
    };
  }, [calendar !== null]);

  if (!calendar) return null;
  const phase = {
    dawn: { label: 'Amanecer', glyph: '☼' },
    day: { label: 'Día', glyph: '☀' },
    dusk: { label: 'Atardecer', glyph: '◒' },
    night: { label: 'Noche', glyph: '☾' },
  }[calendar.daylightPhase] || { label: 'Día', glyph: '☀' };

  return (
    <div className="chronicles-world-info__backdrop" data-chronicles-world-info-backdrop
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chronicles-world-info" data-chronicles-world-info
        data-daylight-phase={calendar.daylightPhase}
        role="dialog" aria-modal="true" aria-labelledby="chronicles-world-info-title"
        aria-describedby="chronicles-world-info-hint"
        onKeyDown={(event) => {
          // Keep keyboard navigation in the open modal, not the world behind it.
          if (chroniclesWorldInfoShortcut(event, { open: true }) === 'close') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === 'Tab') {
            event.preventDefault();
            closeRef.current?.focus();
          } else event.stopPropagation();
        }}>
        <header className="chronicles-world-info__head">
          <span className="chronicles-world-info__seal" aria-hidden="true">✦</span>
          <div className="chronicles-world-info__heading">
            <small>TERRA · CRÓNICA DEL VIAJE</small>
            <h2 id="chronicles-world-info-title">INFORMACIÓN DEL JUEGO</h2>
          </div>
          <button type="button" ref={closeRef} className="chronicles-world-info__close"
            onClick={onClose} aria-label="Cerrar información" title="Cerrar · I o Esc">×</button>
        </header>
        <div className="chronicles-world-info__paper">
          <div className="chronicles-world-info__daymark">
            <span className="chronicles-world-info__daymark-glyph" aria-hidden="true">{phase.glyph}</span>
            <span className="chronicles-world-info__daymark-name">{phase.label}</span>
          </div>
          <p className="chronicles-world-info__weekday">{calendar.weekday} <span aria-hidden="true">✦</span> {calendar.season}</p>
          <div className="chronicles-world-info__clock">
            <span className="chronicles-world-info__clock-kicker">HORA DE TERRA</span>
            <strong data-chronicles-world-info-time>{calendar.time}</strong>
          </div>
          <dl className="chronicles-world-info__calendar" aria-label="Calendario de Terra">
            <div><dt>Día</dt><dd>{calendar.dayOfYear}</dd></div>
            <div><dt>Mes</dt><dd>{calendar.month}</dd></div>
            <div><dt>Año</dt><dd>{calendar.year}</dd></div>
          </dl>
        </div>
        <footer className="chronicles-world-info__foot" id="chronicles-world-info-hint">
          <span>Consultar no consume turno</span>
          <span><kbd>I</kbd> / <kbd>Esc</kbd> · cerrar</span>
        </footer>
      </section>
    </div>
  );
}
