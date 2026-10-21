import { useState } from 'react';
import { chroniclesOpeningVolleyShooters, chroniclesPartyAttackStats } from '../chroniclesOfMatthias.js';
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
export function chroniclesFirstThreatDetails(state, target) {
  if (state?.mapId !== 'banner-road-first-book' || state?.phase !== 'explore'
    || state?.initiative || !target?.enemy || !(Number(target.distance) >= 1)) return null;
  // Use the exact weapon ranges consumed by resolveOpeningVolley. An armed
  // slinger at four cells is NOT an available shot, even though S can still
  // launch its projectile into empty air at the cost of a turn.
  const shooters = chroniclesOpeningVolleyShooters(state);
  const inRangeShooterCount = shooters.filter((member) =>
    chroniclesPartyAttackStats(state, member.id, 'missile').reach >= target.distance
  ).length;
  return {
    name: target.enemy.name,
    distance: Number(target.distance),
    shooterCount: shooters.length,
    inRangeShooterCount,
  };
}

export default function ChroniclesFirstThreatCue({
  state, target, runId, suspended = false,
}) {
  const [dismissed, setDismissed] = useState(() => chroniclesFirstThreatDismissed(runId));
  const sighting = chroniclesFirstThreatDetails(state, target);
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
        {sighting.inRangeShooterCount > 0
          ? `Tienes ${sighting.inRangeShooterCount === sighting.shooterCount
            ? `${sighting.inRangeShooterCount} ${sighting.inRangeShooterCount === 1 ? 'tirador listo' : 'tiradores listos'}`
            : `${sighting.inRangeShooterCount} de ${sighting.shooterCount} tiradores a tiro`}: S dispara una salva antes del contacto.`
          : sighting.shooterCount > 0
            ? 'Llevas armas de proyectiles, pero este enemigo está fuera de su alcance. Acércate antes de usar S.'
            : 'No hay tiradores listos. Equipa armas de proyectiles para usar S con tu grupo.'}
        {' '}A ataca cuerpo a cuerpo cuando el enemigo esté al alcance. En combate, sigue el orden de iniciativa.
      </small>
      <button type="button" className="chronicles-first-threat__dismiss" onClick={dismiss}>Entendido</button>
    </aside>
  );
}
