import { useState } from 'react';
import { getStorageItem, setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import './ChroniclesFirstSteps.css';

const FIRST_STEPS_MARKER = 'chronicles:lost-king:commission-received';
const DISMISSED_PREFIX = 'chronicles-first-steps-dismissed-v1:';

function dismissalKey(runId) {
  return DISMISSED_PREFIX + encodeURIComponent(String(runId || ''));
}

// The authored commission, not a guessed visit count, identifies the first
// minutes of the actual Swordhaven campaign. No tutorial for legacy/Tactics,
// other maps, completed quests or returning expeditions.
export function chroniclesShouldOfferFirstSteps(state) {
  return state?.mapId === 'swordhaven-square'
    && state?.phase === 'explore'
    && Number.isInteger(state?.turns) && state.turns >= 0 && state.turns <= 2
    && state?.quests?.['lost-king-prologue']?.status === 'active'
    && state?.consumedContentIds?.includes(FIRST_STEPS_MARKER) === true;
}

export function chroniclesFirstStepsDismissed(runId) {
  return Boolean(runId) && getStorageItem(STORAGE_SESSION, dismissalKey(runId)) === '1';
}

export default function ChroniclesFirstSteps({
  state, runId, open = false, suspended = false, onClose = () => {}, onOpenJournal = () => {},
}) {
  const [dismissed, setDismissed] = useState(() => chroniclesFirstStepsDismissed(runId));
  const visible = open || (!suspended && !dismissed && Boolean(runId) && chroniclesShouldOfferFirstSteps(state));
  if (!visible) return null;

  const close = () => {
    if (runId) setStorageItem(STORAGE_SESSION, dismissalKey(runId), '1');
    setDismissed(true);
    onClose();
  };

  return (
    <aside className="chronicles-first-steps" data-chronicles-first-steps aria-label="Primeros pasos con Matthias"
      onKeyDown={(event) => event.stopPropagation()}>
      <div className="chronicles-first-steps__heading">
        <strong>MATTHIAS · PRIMEROS PASOS</strong>
        <button type="button" aria-label="Cerrar primeros pasos" onClick={close}>×</button>
      </div>
      <p>La carta de la Dama nos envía tras el Rey. Empecemos por orientarnos en Swordhaven.</p>
      <small>Flechas: avanzar y girar · <kbd>M</kbd> mapa · <kbd>J</kbd> Crónica</small>
      <details>
        <summary>¿Cómo se juega?</summary>
        <p><kbd>A</kbd> cuerpo a cuerpo · <kbd>S</kbd> disparar · <kbd>F</kbd> usar/recoger si hay una acción disponible. En móvil, usa los botones de la pantalla.</p>
      </details>
      <div className="chronicles-first-steps__actions">
        <button type="button" onClick={() => { close(); onOpenJournal(); }}>Ver encargo</button>
        <button type="button" onClick={close}>Entendido</button>
      </div>
    </aside>
  );
}
