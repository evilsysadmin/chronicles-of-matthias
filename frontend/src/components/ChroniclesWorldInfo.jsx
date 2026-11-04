import { useEffect, useRef } from 'react';

// A read-only MM3-style Game Information parchment. No timers, world
// mutations or save writes: the calendar comes from the run's saved minutes.
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
    dawn: 'Amanecer', day: 'Día', dusk: 'Atardecer', night: 'Noche',
  }[calendar.daylightPhase] || 'Día';

  return (
    <div className="chronicles-world-info__backdrop" data-chronicles-world-info-backdrop
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chronicles-world-info" data-chronicles-world-info
        role="dialog" aria-modal="true" aria-labelledby="chronicles-world-info-title"
        onKeyDown={(event) => {
          // Keep the sole close button in focus and never send modal shortcuts
          // into the game, especially movement/combat and the Equip I key.
          if (event.key === 'Escape' || event.key.toLowerCase() === 'i') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === 'Tab') {
            event.preventDefault();
            closeRef.current?.focus();
          } else event.stopPropagation();
        }}>
        <header>
          <div>
            <small>CHRONICLES OF MATTHIAS</small>
            <h2 id="chronicles-world-info-title">INFORMACIÓN DEL JUEGO</h2>
          </div>
          <button type="button" ref={closeRef} onClick={onClose}
            aria-label="Cerrar información" title="Cerrar · I o Esc">×</button>
        </header>
        <div className="chronicles-world-info__paper">
          <div className="chronicles-world-info__date">
            <span>{calendar.weekday} · {calendar.season}</span>
            <strong>{calendar.time}</strong>
            <small>{phase}</small>
          </div>
          <dl>
            <div><dt>Día</dt><dd>{calendar.dayOfYear}</dd></div>
            <div><dt>Mes</dt><dd>{calendar.month}</dd></div>
            <div><dt>Año</dt><dd>{calendar.year}</dd></div>
          </dl>
          <p>Día {calendar.dayOfMonth} del mes {calendar.month} · Año {calendar.year}</p>
        </div>
        <footer>Consultar el calendario no consume turno · I o Esc para cerrar</footer>
      </section>
    </div>
  );
}
