import { useState } from 'react';
import { getStorageItem, setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import './ChroniclesFirstThreatCue.css';

const DISMISS_PREFIX = 'chronicles-first-threat-dismissed-v1:';

function dismissalKey(runId) {
  return DISMISS_PREFIX + encodeURIComponent(String(runId || ''));
}

export function chroniclesFirstThreatDismissed(runId) {
  return Boolean(runId) && getStorageItem(STORAGE_SESSION, dismissalKey(runId)) === '1';
}

// Targeting and the opening-volley shooter roster are supplied by the real
// reducer's helpers. Never infer a sighting from map location or award a hit.
export function chroniclesFirstThreatDetails(state, target, shooterCount) {
  if (state?.mapId !== 'banner-road-first-book' || state?.phase !== 'explore'
    || state?.initiative || !target?.enemy || !(Number(target.distance) >= 1)) return null;
  const count = Math.max(0, Math.floor(Number(shooterCount) || 0));
  return {
    name: target.enemy.name,
    distance: Number(target.distance),
    shooterCount: count,
  };
}

export default function ChroniclesFirstThreatCue({
  state, target, shooterCount = 0, runId, suspended = false,
}) {
  const [dismissed, setDismissed] = useState(() => chroniclesFirstThreatDismissed(runId));
  const sighting = chroniclesFirstThreatDetails(state, target, shooterCount);
  if (suspended || dismissed || !runId || !sighting) return null;

  const dismiss = () => {
    setStorageItem(STORAGE_SESSION, dismissalKey(runId), '1');
    setDismissed(true);
  };

  return (
    <aside className="chronicles-first-threat" data-chronicles-first-threat
      aria-label="Primer peligro en el Camino del Estandarte"
      onKeyDown={(event) => event.stopPropagation()}>
      <div className="chronicles-first-threat__head">
        <strong>MATTHIAS · PRIMER PELIGRO</strong>
        <button type="button" onClick={dismiss} aria-label="Cerrar consejo de combate">×</button>
      </div>
      <p>«{sighting.name} delante, a {sighting.distance} {sighting.distance === 1 ? 'casilla' : 'casillas'}.
        Por fin alguien con peor juicio que nosotros».</p>
      <small>
        {sighting.shooterCount > 0
          ? `Tienes ${sighting.shooterCount} ${sighting.shooterCount === 1 ? 'tirador listo' : 'tiradores listos'}: S dispara una salva antes del contacto.`
          : 'No hay tiradores listos. Equipa armas de proyectiles para usar S con tu grupo.'}
        {' '}A ataca cuerpo a cuerpo cuando el enemigo esté al alcance. En combate, sigue el orden de iniciativa.
      </small>
      <button type="button" className="chronicles-first-threat__dismiss" onClick={dismiss}>Entendido</button>
    </aside>
  );
}
