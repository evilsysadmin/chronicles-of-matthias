import { STORAGE_SESSION, readJsonStorage, removeStorageItem, writeJsonStorage } from '../safeStorage.js';

// F5 is not «leave without saving». While a run is played, this tab keeps a
// copy of where the company is; a reload picks it up as long as the server
// has not seen a newer save since. Closing the tab, «Salir sin guardar» or
// going back to the book still drop unsaved play, per the MM3 save contract.
const KEY = 'chronicles-resume-v1:';

export function chroniclesSaveSessionResume(runId, { state, worldVersion, progression, automap }) {
  if (!runId || !state) return;
  writeJsonStorage(STORAGE_SESSION, `${KEY}${runId}`, {
    worldVersion: Number(worldVersion || 0),
    state,
    progression: progression || null,
    automap: automap || null,
    at: Date.now(),
  });
}

export function chroniclesLoadSessionResume(runId, worldVersion) {
  if (!runId) return null;
  const stored = readJsonStorage(STORAGE_SESSION, `${KEY}${runId}`, { fallback: null, removeMalformed: true });
  if (!stored || typeof stored !== 'object' || !stored.state || typeof stored.state !== 'object') return null;
  // A newer server save (another tab, another device) wins over this copy.
  if (Number(stored.worldVersion) !== Number(worldVersion || 0)) return null;
  return stored;
}

export function chroniclesClearSessionResume(runId) {
  if (runId) removeStorageItem(STORAGE_SESSION, `${KEY}${runId}`);
}
