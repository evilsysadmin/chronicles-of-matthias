import { useState } from 'react';
import { getStorageItem, setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import './ChroniclesFirstSteps.css';

const FIRST_STEPS_MARKER = 'chronicles:lost-king:commission-received';
const FIRST_BOOK_ARRIVAL_MARKER = 'arrival:swordhaven-first-book';
const DISMISSED_PREFIX = 'chronicles-first-steps-dismissed-v1:';

function dismissalKey(runId) {
  return DISMISSED_PREFIX + encodeURIComponent(String(runId || ''));
}

// The authored commission, not a guessed visit count, identifies the first
// minutes of the actual Swordhaven campaign. No tutorial for legacy/Tactics,
// other maps, completed quests or returning expeditions.
export function chroniclesFirstStepsStory(state) {
  if (state?.phase !== 'explore' || !Number.isInteger(state?.turns)
    || state.turns < 0 || state.turns > 2) return null;
  if (state.mapId === 'swordhaven-first-book'
    && state?.quests?.['lost-king']?.status === 'active'
    && state?.consumedContentIds?.includes(FIRST_BOOK_ARRIVAL_MARKER)) return 'first-book';
  if (state.mapId === 'swordhaven-square'
    && state?.quests?.['lost-king-prologue']?.status === 'active'
    && state?.consumedContentIds?.includes(FIRST_STEPS_MARKER)) return 'prologue';
  return null;
}

export function chroniclesShouldOfferFirstSteps(state) {
  return chroniclesFirstStepsStory(state) !== null;
}

export function chroniclesFirstStepsDismissed(runId) {
  return Boolean(runId) && getStorageItem(STORAGE_SESSION, dismissalKey(runId)) === '1';
}

export default function ChroniclesFirstSteps({
  state, runId, open = false, suspended = false, onClose = () => {}, onOpenJournal = () => {},
}) {
  const [dismissed, setDismissed] = useState(() => chroniclesFirstStepsDismissed(runId));
  const story = chroniclesFirstStepsStory(state);
  const visible = open || (!suspended && !dismissed && Boolean(runId) && Boolean(story));
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
      <p>{story === 'first-book'
        ? 'El Rey ha desaparecido. En Swordhaven, busca al alcalde Aldric para recibir el primer encargo.'
        : story === 'prologue'
          ? 'La carta de la Dama nos envía tras el Rey. Empecemos por orientarnos en Swordhaven.'
          : 'Consulta el objetivo actual en la Crónica y oriéntate con el mapa.'}</p>
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
